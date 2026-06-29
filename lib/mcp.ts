/**
 * Minimal client for the Kapruka MCP server.
 *
 * Transport: Streamable HTTP (JSON-RPC 2.0 over POST). The server replies with
 * Server-Sent Events (`event: message` / `data: {...}`) and assigns a session id
 * via the `Mcp-Session-Id` response header on `initialize`, which must be echoed
 * back on every subsequent request.
 *
 * Verified live against https://mcp.kapruka.com/mcp:
 *   - No auth required. ~60 req/min/IP; create_order 30/hr/IP.
 *   - Every tool nests its arguments under a `params` object.
 *   - Tools support `response_format: "json"`, returning a JSON *string* in
 *     `result.content[0].text` (empty/error cases come back as plain text).
 */

const MCP_URL = process.env.KAPRUKA_MCP_URL ?? "https://mcp.kapruka.com/mcp";
const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "malee-kapruka-concierge", version: "0.1.0" };

export class McpError extends Error {
  code?: string | number;
  status?: number;
  retryAfterSeconds?: number;
  constructor(
    message: string,
    opts: { code?: string | number; status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "McpError";
    this.code = opts.code;
    this.status = opts.status;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export interface ToolResult {
  /** Parsed JSON payload when the tool returned valid JSON, else null. */
  json: unknown | null;
  /** Raw text payload (the tool's `content[0].text`). */
  text: string;
}

// ---- session state (module-scoped; survives within a warm server instance) ----
let sessionId: string | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
let rpcCounter = 0;

function nextId(): number {
  rpcCounter += 1;
  return rpcCounter;
}

function buildHeaders(withSession: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (withSession && sessionId) headers["Mcp-Session-Id"] = sessionId;
  return headers;
}

async function post(body: unknown, withSession: boolean): Promise<Response> {
  return fetch(MCP_URL, {
    method: "POST",
    headers: buildHeaders(withSession),
    body: JSON.stringify(body),
    // The MCP server is cached up to 30 min server-side; we never want a stale
    // intermediary cache to swallow a tool call.
    cache: "no-store",
  });
}

/**
 * Read a JSON-RPC response that may arrive as either application/json or an SSE
 * stream. Returns the payload object matching `id` (or the first result/error).
 */
async function readJsonRpc(res: Response, id: number): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!contentType.includes("text/event-stream")) {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new McpError(`Non-JSON response from MCP (status ${res.status}): ${text.slice(0, 200)}`, {
        status: res.status,
      });
    }
  }

  // Parse SSE: split into events on blank lines, collect `data:` lines per event.
  const events: Record<string, unknown>[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as Record<string, unknown>);
    } catch {
      /* ignore non-JSON event payloads (e.g. keep-alives) */
    }
  }

  const match =
    events.find((e) => e.id === id) ??
    events.find((e) => e.result !== undefined || e.error !== undefined) ??
    events[events.length - 1];

  if (!match) {
    throw new McpError(`Empty SSE response from MCP (status ${res.status})`, { status: res.status });
  }
  return match;
}

function throwOnHttpError(res: Response): void {
  if (res.status === 429) {
    const reset = Number(res.headers.get("ratelimit-reset") ?? res.headers.get("retry-after") ?? "0");
    throw new McpError("Kapruka is busy right now (rate limit). Please try again in a moment.", {
      code: "rate_limited",
      status: 429,
      retryAfterSeconds: Number.isFinite(reset) ? reset : undefined,
    });
  }
}

async function doInitialize(): Promise<void> {
  const id = nextId();
  const res = await post(
    {
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    },
    false,
  );
  throwOnHttpError(res);
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;

  const payload = await readJsonRpc(res, id);
  if (payload.error) {
    throw new McpError(`MCP initialize failed: ${JSON.stringify(payload.error)}`);
  }

  // Notify the server we're ready (notification: no id, no response expected).
  await post({ jsonrpc: "2.0", method: "notifications/initialized" }, true).catch(() => {
    /* best-effort; some servers don't require it */
  });

  initialized = true;
}

async function ensureSession(): Promise<void> {
  if (initialized && sessionId) return;
  if (!initPromise) {
    initPromise = doInitialize().catch((err) => {
      // Reset so a later call can retry from scratch.
      initialized = false;
      sessionId = null;
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

function resetSession(): void {
  initialized = false;
  sessionId = null;
  initPromise = null;
}

// ---- read-only response cache (cuts rate-limit pressure; per warm instance) ----
// Kapruka explicitly asks clients to cache aggressively to stay under the
// ~60 req/min limit (and create_order's 30/hr). Read-only tools are cached with
// a TTL scaled to how static they are; state-changing / realtime tools
// (create_order, track_order) are deliberately absent here, so never cached.
const READ_TTL_MS: Record<string, number> = {
  kapruka_list_categories: 30 * 60_000,
  kapruka_list_delivery_cities: 30 * 60_000,
  kapruka_get_product: 5 * 60_000,
  kapruka_search_products: 2 * 60_000,
};
const MAX_CACHE_ENTRIES = 200;
const responseCache = new Map<string, { at: number; value: ToolResult }>();

function cacheKey(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(args)}`;
}

/**
 * Call a Kapruka MCP tool by name. `args` are the flat tool arguments (e.g.
 * `{ q: "roses", limit: 6 }`); they are wrapped in the required `params`
 * envelope and `response_format: "json"` is injected automatically.
 *
 * Read-only tools are served from a short-lived in-memory cache when fresh,
 * avoiding a network round-trip (and the rate limit) entirely.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown> = {},
  _retried = false,
): Promise<ToolResult> {
  const ttl = READ_TTL_MS[name];
  const key = ttl ? cacheKey(name, args) : "";
  if (ttl) {
    const hit = responseCache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
  }

  await ensureSession();

  const id = nextId();
  const res = await post(
    {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name,
        arguments: { params: { response_format: "json", ...args } },
      },
    },
    true,
  );

  // Session expired / unknown -> re-initialize once and retry.
  if ((res.status === 404 || res.status === 400) && !_retried) {
    await res.text().catch(() => undefined);
    resetSession();
    return callTool(name, args, true);
  }

  throwOnHttpError(res);

  const payload = await readJsonRpc(res, id);
  if (payload.error) {
    const err = payload.error as { message?: string; code?: number };
    throw new McpError(err.message ?? "MCP tool error", { code: err.code });
  }

  const result = (payload.result ?? {}) as {
    content?: { type: string; text?: string }[];
    structuredContent?: { result?: string };
    isError?: boolean;
  };

  const text =
    result.content?.find((c) => c.type === "text")?.text ??
    result.structuredContent?.result ??
    "";

  let json: unknown | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null; // empty-result / "Error: ..." strings are returned as text only
  }

  if (result.isError) {
    throw new McpError(text || "MCP tool reported an error", { code: "tool_error" });
  }

  const value: ToolResult = { json, text };
  if (ttl) {
    responseCache.set(key, { at: Date.now(), value });
    if (responseCache.size > MAX_CACHE_ENTRIES) {
      const oldest = responseCache.keys().next().value;
      if (oldest) responseCache.delete(oldest);
    }
  }
  return value;
}

/** List available tools — handy for debugging / verifying the catalog of tools. */
export async function listTools(): Promise<unknown> {
  await ensureSession();
  const id = nextId();
  const res = await post({ jsonrpc: "2.0", id, method: "tools/list" }, true);
  throwOnHttpError(res);
  const payload = await readJsonRpc(res, id);
  if (payload.error) throw new McpError(JSON.stringify(payload.error));
  return payload.result;
}
