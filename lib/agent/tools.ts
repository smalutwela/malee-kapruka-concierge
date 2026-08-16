import { tool } from "ai";
import { z } from "zod";
import { callTool, McpError } from "@/lib/mcp";
import {
  cleanProductName,
  normalizeAddresses,
  normalizeCustomer,
  normalizeOrderHistory,
} from "@/lib/account/normalize";
import type { AccountOrder, AccountOrderHistory } from "@/lib/types";

/**
 * Curated tools exposed to Claude. Each has a clean, flat schema (no `params`
 * wrapper — the MCP client adds that) and a prescriptive description. Executors
 * translate camelCase → the MCP snake_case fields, default currency to LKR, and
 * return parsed JSON for both the model and the UI to render.
 */

/**
 * Never let the Phase 2 access token out of the server. The MCP server echoes
 * rejected argument values back in its validation errors ("input_value='…'"), so
 * a malformed token would otherwise ride an error string into the model's
 * context and the browser transcript. Belt and braces: the token is also never
 * placed in any successful tool result.
 */
function redact(message: string): string {
  const token = process.env.KAPRUKA_ACCESS_TOKEN;
  if (token && token.length >= 8 && message.includes(token)) {
    return message.split(token).join("[redacted]");
  }
  return message;
}

/** Server-side error text ("Error (product_not_found): …") vs an empty result. */
function fromText(text: string): unknown {
  const clean = redact(text.trim());
  if (!clean) return { note: "No data returned." };
  return /^error\b/i.test(clean) ? { error: clean } : { note: clean };
}

async function run(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const { json, text } = await callTool(name, args);
    // Some failures arrive as a JSON-encoded *string* rather than an object
    // (e.g. "Error (email_not_allowed): …"), which parses fine but is not data.
    if (typeof json === "string") return fromText(json);
    if (json !== null) return json;
    // Empty result / server-side validation message comes back as plain text.
    return fromText(text);
  } catch (err) {
    if (err instanceof McpError) {
      return { error: redact(err.message), code: err.code ?? null };
    }
    return {
      error: redact(err instanceof Error ? err.message : "Unexpected error calling Kapruka."),
    };
  }
}

/** True when a search came back with no products (empty list or a "no results" note). */
function isEmptyResult(r: unknown): boolean {
  if (!r || typeof r !== "object") return true;
  const o = r as { results?: unknown[]; note?: string; error?: string };
  if (o.error) return false; // a hard error (rate limit etc.) is handled by the model
  if (Array.isArray(o.results)) return o.results.length === 0;
  if (o.note) return true; // "No products found" arrives as a note
  return false;
}

/**
 * The catalogue sometimes returns the same product twice in one search. Collapse
 * by id (keep first) so the UI's `key={p.id}` stays unique and the model sees
 * each item once. Items without an id are left untouched.
 */
function dedupeById(res: unknown): unknown {
  if (!res || typeof res !== "object") return res;
  const r = res as { results?: unknown };
  if (!Array.isArray(r.results)) return res;
  const seen = new Set<string>();
  const results = (r.results as { id?: unknown }[]).filter((p) => {
    const id = typeof p?.id === "string" ? p.id : null;
    if (id === null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return { ...r, results };
}

// Filler / shopping chatter we ignore when judging whether results match the
// query — these words wouldn't appear in a product name anyway.
const QUERY_STOPWORDS = new Set([
  "the", "and", "for", "with", "any", "some", "this", "that", "kapruka",
  "best", "good", "nice", "fresh", "brand", "branded", "quality",
  "pack", "packet", "please", "want", "need", "looking",
]);

/** Meaningful query words (≥3 chars, not filler) to test result relevance against. */
function significantTokens(q: string): string[] {
  return Array.from(
    new Set(
      q
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((w) => w.length >= 3 && !QUERY_STOPWORDS.has(w)),
    ),
  );
}

/** On-topic if any significant query word appears (whole-word) in the name or category. */
function onTopic(result: unknown, tokens: string[]): boolean {
  const r = result as { name?: unknown; category?: { name?: unknown } };
  const name = typeof r?.name === "string" ? r.name : "";
  const cat = r?.category && typeof r.category.name === "string" ? r.category.name : "";
  const hay = `${name} ${cat}`.toLowerCase();
  return tokens.some((t) => new RegExp(`\\b${t}\\b`).test(hay));
}

/**
 * Kapruka's search is fuzzy: a rare or over-specific query (e.g. "samba rice")
 * can come back as a few unrelated popular items (chocolate hampers) instead of
 * nothing — which would then render as product cards verbatim. When NONE of the
 * results share a meaningful word with the query, treat it as a miss: return an
 * empty set + a note so the model retries with a simpler word, rather than
 * surfacing junk. Conservative — only triggers on a TOTAL mismatch, so normal
 * and gift searches (whose head noun appears in the names) pass through untouched.
 */
function dropIrrelevant(res: unknown, q: string): unknown {
  if (!res || typeof res !== "object") return res;
  const r = res as { results?: unknown[] };
  if (!Array.isArray(r.results) || r.results.length === 0) return res;
  const tokens = significantTokens(q);
  if (tokens.length === 0) return res; // nothing specific to match on — leave as-is
  if (r.results.some((item) => onTopic(item, tokens))) return res; // at least one real hit
  return {
    results: [],
    note: `Search returned only unrelated items for "${q}". Retry with a simpler, single-word product name.`,
  };
}

/**
 * Strip product `url`s from search results before they reach the model. The
 * search cards (ProductGrid/ProductCard) never use them, but a weak model will
 * happily paste them as markdown links in chat — redundant next to the cards and
 * against the "never hand out product URLs" rule. getProduct keeps its url for
 * the detail card's "View on Kapruka" link; only the noisy list view is stripped.
 */
function stripResultUrls(res: unknown): unknown {
  if (!res || typeof res !== "object") return res;
  const r = res as { results?: unknown[] };
  if (!Array.isArray(r.results)) return res;
  const results = r.results.map((p) => {
    if (!p || typeof p !== "object") return p;
    const clone = { ...(p as Record<string, unknown>) };
    delete clone.url;
    return clone;
  });
  return { ...r, results };
}

/**
 * Search is private research for the model; only `presentProducts` renders
 * cards. Every searched summary is stashed here (per warm instance) so
 * presentProducts can show a curated subset without re-hitting the network.
 * Misses (cold instance, old id) fall back to a get_product fetch.
 */
const PRESENT_STASH = new Map<string, Record<string, unknown>>();
const PRESENT_STASH_MAX = 600;

function stashResults(res: unknown): void {
  if (!res || typeof res !== "object") return;
  const r = res as { results?: unknown[] };
  if (!Array.isArray(r.results)) return;
  for (const p of r.results) {
    const item = p as Record<string, unknown> | null;
    if (!item || typeof item.id !== "string") continue;
    PRESENT_STASH.delete(item.id); // refresh insertion order (Map iterates oldest-first)
    PRESENT_STASH.set(item.id, item);
  }
  while (PRESENT_STASH.size > PRESENT_STASH_MAX) {
    const oldest = PRESENT_STASH.keys().next().value;
    if (oldest === undefined) break;
    PRESENT_STASH.delete(oldest);
  }
}

/** Map a get_product detail payload to the summary shape the product cards render. */
function detailToSummary(detail: unknown): Record<string, unknown> | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown> & { images?: unknown[] };
  if (typeof d.id !== "string") return null;
  return {
    id: d.id,
    name: d.name,
    summary: d.summary,
    price: d.price,
    compare_at_price: d.compare_at_price,
    in_stock: d.in_stock,
    stock_level: d.stock_level,
    image_url: Array.isArray(d.images) ? (d.images[0] ?? null) : null,
    category: d.category,
  };
}

const currency = z
  .string()
  .default("LKR")
  .describe("Pricing currency: LKR (default), USD, GBP, AUD, CAD, EUR.");

export const kaprukaTools = {
  searchProducts: tool({
    description:
      "Search Kapruka's live catalogue. Call this whenever the shopper wants to find or browse anything — groceries, electronics, home, fashion, beauty, gifts and more. Use specific, descriptive queries (e.g. 'basmati rice 5kg', 'wireless earbuds', 'red roses bouquet') rather than single vague words — vague queries can return nothing. IMPORTANT: results are PRIVATE research for you — the shopper sees nothing. After choosing which items are actually worth showing, you MUST call presentProducts with their ids to display the product cards.",
    inputSchema: z.object({
      q: z.string().min(3).describe("Descriptive search query, at least 3 characters."),
      category: z
        .string()
        .optional()
        .describe("Optional category filter, e.g. 'Flowers', 'Cakes', 'Chocolates'."),
      limit: z.number().int().min(1).max(20).default(8).describe("How many results (1–20)."),
      minPrice: z.number().min(0).optional().describe("Minimum price in the chosen currency."),
      maxPrice: z.number().min(0).optional().describe("Maximum price in the chosen currency."),
      inStockOnly: z.boolean().default(true).describe("Only show items currently in stock."),
      sort: z
        .enum(["relevance", "price_asc", "price_desc", "newest", "bestseller"])
        .default("relevance")
        .describe("Result ordering."),
      currency,
    }),
    execute: async ({ q, category, limit, minPrice, maxPrice, inStockOnly, sort, currency }) => {
      const base = {
        q,
        limit,
        min_price: minPrice,
        max_price: maxPrice,
        in_stock_only: inStockOnly,
        sort,
        currency,
      };
      let res = await run("kapruka_search_products", { ...base, category });
      // Catalogue quirk: most items are filed under "General", so a category
      // filter frequently empties the results. Retry once without it.
      if (isEmptyResult(res) && category) {
        res = await run("kapruka_search_products", base);
      }
      const cleaned = stripResultUrls(dropIrrelevant(dedupeById(res), q));
      stashResults(cleaned);
      return cleaned;
    },
  }),

  presentProducts: tool({
    description:
      "Show the shopper a set of product cards. This is the ONLY way products become visible — searchProducts results are private to you. Call it with the ids of the items you actually recommend (best pick first, max 8), after filtering out anything irrelevant, off-topic, or unworthy. Never present items you wouldn't stand behind; if a search returned junk, search again instead of presenting it.",
    inputSchema: z.object({
      productIds: z
        .array(z.string().min(3))
        .min(1)
        .max(8)
        .describe("Product ids from earlier searchProducts/getProduct results, best first."),
    }),
    execute: async ({ productIds }) => {
      const results: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      for (const id of productIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        const stashed = PRESENT_STASH.get(id);
        if (stashed) {
          results.push(stashed);
          continue;
        }
        // Cold instance or an id from getProduct — fetch (cached 5 min in lib/mcp).
        const detail = detailToSummary(await run("kapruka_get_product", { product_id: id, currency: "LKR" }));
        if (detail) results.push(detail);
      }
      if (!results.length) {
        return { note: "None of those product ids could be shown — re-check the ids from your search results." };
      }
      return { results };
    },
  }),

  getProduct: tool({
    description:
      "Fetch full details for one product by its ID (from a search result). Use when the shopper wants more detail, images, variants, or to confirm stock before adding to an order.",
    inputSchema: z.object({
      productId: z.string().min(3).describe("Kapruka product ID, e.g. 'FLOWERS00T2075'."),
      currency,
    }),
    execute: async ({ productId, currency }) => {
      const detail = await run("kapruka_get_product", { product_id: productId, currency });
      const summary = detailToSummary(detail);
      if (summary) stashResults({ results: [summary] });
      return detail;
    },
  }),

  addToCart: tool({
    description:
      "Add a product to the shopper's in-app cart (the cart drawer in this chat). Call this whenever the shopper asks to add/put/keep an item in their cart or basket for later checkout. Pass ONLY the product id and quantity — the item's real name, price, and image are fetched from the catalogue, and the cart updates instantly. This does NOT place an order (checkout still goes through createOrder after confirmation). NEVER tell the shopper an item is in their cart without calling this tool.",
    inputSchema: z.object({
      productId: z.string().min(3).describe("Kapruka product ID from earlier search/present results."),
      quantity: z.number().int().min(1).max(99).default(1),
    }),
    execute: async ({ productId, quantity }) => {
      // Authoritative item data only — the stash (filled by every search) or a
      // cached get_product fetch. The model never types names or prices here,
      // so the cart can't drift from the live catalogue.
      let item = PRESENT_STASH.get(productId) ?? null;
      if (!item) {
        item = detailToSummary(
          await run("kapruka_get_product", { product_id: productId, currency: "LKR" }),
        );
      }
      if (!item || typeof item.id !== "string") {
        return {
          error: `Product ${productId} was not found — re-check the id from your search results.`,
        };
      }
      if (item.in_stock === false) {
        return {
          error: `"${item.name}" is out of stock right now — offer an alternative instead of adding it.`,
        };
      }
      return {
        // Unique per add — the client applies each addId to the cart exactly
        // once, so a restored transcript can't re-add items on re-scan.
        addId: crypto.randomUUID(),
        quantity,
        item: {
          id: item.id,
          name: item.name,
          price: item.price ?? null,
          image: item.image_url ?? null,
        },
      };
    },
  }),

  listCategories: tool({
    description:
      "List Kapruka's top-level product categories. Use when the shopper is unsure what to get and wants to browse by category.",
    inputSchema: z.object({
      depth: z.number().int().min(1).max(2).default(1).describe("Sub-category levels (1 or 2)."),
    }),
    execute: ({ depth }) => run("kapruka_list_categories", { depth }),
  }),

  listDeliveryCities: tool({
    description:
      "Find Kapruka-serviceable Sri Lankan cities matching a query (e.g. 'colombo', 'kandy'). Use to resolve the canonical city name before checking delivery or placing an order.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Partial city name or vernacular alias."),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    execute: ({ query, limit }) => run("kapruka_list_delivery_cities", { query, limit }),
  }),

  checkDelivery: tool({
    description:
      "Check whether Kapruka can deliver to a city on a date, and the flat delivery fee. Call before finalising an order. Pass productId for perishable (cake/flower) freshness warnings.",
    inputSchema: z.object({
      city: z.string().min(2).describe("Canonical city name from listDeliveryCities, e.g. 'Colombo 03'."),
      deliveryDate: z
        .string()
        .optional()
        .describe("Target date YYYY-MM-DD (Asia/Colombo). Omit to check today."),
      productId: z.string().optional().describe("Optional product ID to enable perishable warnings."),
    }),
    execute: ({ city, deliveryDate, productId }) =>
      run("kapruka_check_delivery", {
        city,
        delivery_date: deliveryDate,
        product_id: productId,
      }),
  }),

  createOrder: tool({
    description:
      "Place a guest-checkout order on Kapruka and return a click-to-pay link. ONLY call this AFTER showing the shopper a clear order summary (items, delivery fee, grand total) and receiving their explicit confirmation. The price is locked for 60 minutes once created.",
    inputSchema: z.object({
      cart: z
        .array(
          z.object({
            productId: z.string().describe("Kapruka product ID."),
            name: z
              .string()
              .max(150)
              .optional()
              .describe("Product name exactly as the catalogue shows it — used for the receipt display."),
            unitPrice: z
              .number()
              .optional()
              .describe(
                "Unit price in LKR exactly as the catalogue showed it — used only for the local receipt/history display, never sent to Kapruka.",
              ),
            quantity: z.number().int().min(1).max(99).default(1),
            icingText: z.string().max(120).optional().describe("Cake icing text (cakes only)."),
          }),
        )
        .min(1)
        .max(30),
      recipient: z.object({
        name: z.string().min(1).max(80),
        phone: z.string().min(7).max(30).describe("Sri Lankan phone, local (077…) or E.164 (+9477…)."),
      }),
      delivery: z.object({
        address: z.string().min(3).max(250),
        city: z.string().min(2).max(100).describe("Must be a serviceable city (see listDeliveryCities)."),
        date: z.string().describe("Delivery date YYYY-MM-DD (today or future, Asia/Colombo)."),
        locationType: z.enum(["house", "apartment", "office", "other"]).default("house"),
        instructions: z.string().max(250).optional(),
      }),
      sender: z.object({
        name: z.string().min(1).max(80),
        anonymous: z.boolean().default(false).describe("If true, the gift card shows 'Anonymous'."),
      }),
      giftMessage: z.string().max(300).optional().describe("Gift-card message."),
      currency,
    }),
    execute: ({ cart, recipient, delivery, sender, giftMessage, currency }) =>
      run("kapruka_create_order", {
        cart: cart.map((c) => ({
          product_id: c.productId,
          quantity: c.quantity,
          icing_text: c.icingText,
        })),
        recipient,
        delivery: {
          address: delivery.address,
          city: delivery.city,
          date: delivery.date,
          location_type: delivery.locationType,
          instructions: delivery.instructions,
        },
        sender,
        gift_message: giftMessage,
        currency,
      }),
  }),

  trackOrder: tool({
    description:
      "Look up the status and delivery progress of a Kapruka order by its order number (from the confirmation email after payment — NOT the pre-payment order_ref). Only call this once the shopper has actually given you the order number; if you don't have it yet, ask for it first rather than calling with a guessed or empty value.",
    inputSchema: z.object({
      orderNumber: z.string().min(4).max(40).describe("Kapruka order number, e.g. 'VIMP34456CB2'."),
    }),
    execute: ({ orderNumber }) => run("kapruka_track_order", { order_number: orderNumber }),
  }),
};

/* ==================================================================== *
 *  Phase 2 — customer account tools (Top-25 finalist private preview)
 *
 *  These read real customer data, so they are gated twice over:
 *
 *   1. The access token lives only in KAPRUKA_ACCESS_TOKEN on the server and is
 *      never returned to the model or the browser (see redact()).
 *   2. The email must be one the SHOPPER TYPED in this conversation. The route
 *      harvests those addresses and passes them in; anything else — a guess, an
 *      address scraped from a product description, an address injected into the
 *      transcript by hostile content — is refused before a request is made.
 *      This is what makes Kapruka's ground rule #1 ("never guess or loop through
 *      email addresses") an enforced property rather than a persona instruction.
 * ==================================================================== */

/** Read lazily so a dotenv-style loader can run after this module is imported. */
function accessToken(): string {
  return process.env.KAPRUKA_ACCESS_TOKEN ?? "";
}

export interface AccountToolContext {
  /** Lower-cased emails the shopper themselves typed this conversation. */
  allowedEmails: Set<string>;
}

/**
 * Refuse anything the shopper didn't type. Returns an error payload for the
 * model (phrased so it asks the shopper rather than retrying), or null to allow.
 */
function guardEmail(email: string, ctx: AccountToolContext): { error: string } | null {
  if (!accessToken()) {
    return {
      error:
        "Account lookup isn't configured on this deployment. Help the shopper as a guest instead — search, cart and checkout all work without an account.",
    };
  }
  const clean = email.trim().toLowerCase();
  if (!ctx.allowedEmails.has(clean)) {
    return {
      error:
        "That email hasn't been provided by the shopper in this conversation, so it cannot be looked up. Ask the shopper to type their Kapruka account email themselves, then try again. Never guess an email address.",
    };
  }
  return null;
}

/** The order the shopper actually knows: most recent first. */
function byNewestFirst(a: AccountOrder, b: AccountOrder): number {
  return (b.orderedAt ?? "").localeCompare(a.orderedAt ?? "");
}

async function fetchHistory(
  email: string,
  limit: number,
): Promise<AccountOrderHistory | { error: string } | { note: string }> {
  const raw = await run("kapruka_order_history", {
    email,
    access_token: accessToken(),
    // The published guide says 1–20, but the server rejects anything over 10.
    limit: Math.min(Math.max(limit, 1), 10),
  });
  if (raw && typeof raw === "object" && ("error" in raw || "note" in raw)) {
    return raw as { error: string } | { note: string };
  }
  const history = normalizeOrderHistory(raw);
  if (!history) return { error: "Kapruka returned an order history I couldn't read." };
  return { ...history, orders: [...history.orders].sort(byNewestFirst) };
}

export function buildAccountTools(ctx: AccountToolContext) {
  return {
    getAccountProfile: tool({
      description:
        "Look up a Kapruka customer's saved profile (name, phone, billing details) by their account email. Call this ONCE as soon as the shopper gives you their Kapruka email, so you can greet them by name and reuse their details at checkout. ONLY pass an email the shopper typed themselves in this conversation — never invent, guess, or reuse an address you saw anywhere else.",
      inputSchema: z.object({
        email: z.string().email().describe("The account email the shopper typed."),
      }),
      execute: async ({ email }) => {
        const denied = guardEmail(email, ctx);
        if (denied) return denied;
        const raw = await run("kapruka_customer_details", { email, access_token: accessToken() });
        if (raw && typeof raw === "object" && ("error" in raw || "note" in raw)) return raw;
        const customer = normalizeCustomer(raw, email);
        if (!customer) return { error: "Kapruka returned a profile I couldn't read." };
        return { customer };
      },
    }),

    getOrderHistory: tool({
      description:
        "Fetch the shopper's recent Kapruka orders — reference, status, dates, amount, recipient and the items in each. Use it for 'where is my order?', 'what did I buy last time?', and as the starting point for a repeat purchase. The cards it renders let the shopper track or reorder in one tap, so call this instead of describing orders from memory. For step-by-step delivery progress on ONE order, pass its reference to trackOrder afterwards.",
      inputSchema: z.object({
        email: z.string().email().describe("The account email the shopper typed."),
        limit: z.number().int().min(1).max(10).default(5).describe("How many recent orders (1–10)."),
      }),
      execute: async ({ email, limit }) => {
        const denied = guardEmail(email, ctx);
        if (denied) return denied;
        return fetchHistory(email, limit);
      },
    }),

    getSavedAddresses: tool({
      description:
        "Fetch the delivery addresses saved on the shopper's Kapruka account, plus places they've recently sent to (each labelled Home / Office / recipient name). Call this at checkout instead of asking them to type an address they've already given Kapruka — then confirm which one they want and pass it straight into createOrder. Also useful when they say 'send it to my home' or 'the usual place'.",
      inputSchema: z.object({
        email: z.string().email().describe("The account email the shopper typed."),
      }),
      execute: async ({ email }) => {
        const denied = guardEmail(email, ctx);
        if (denied) return denied;
        const raw = await run("kapruka_customer_addresses", { email, access_token: accessToken() });
        if (raw && typeof raw === "object" && ("error" in raw || "note" in raw)) return raw;
        // The owner's name lets us label their own address "Home".
        const profile = normalizeCustomer(
          await run("kapruka_customer_details", { email, access_token: accessToken() }),
          email,
        );
        const book = normalizeAddresses(raw, email, profile?.fullName ?? null);
        if (!book) return { error: "Kapruka returned an address book I couldn't read." };
        if (!book.addresses.length) {
          return { note: "This account has no saved delivery addresses — collect the address in chat." };
        }
        return book;
      },
    }),

    reorderPastOrder: tool({
      description:
        "Re-price a past Kapruka order against today's live catalogue so the shopper can buy it again. Call this when they want their 'usual', 'the same as last time', or a specific past order again — pass that order's reference from getOrderHistory. It returns each item with its old and current price, whether it's still in stock, and anything discontinued. It does NOT add anything to the cart or place an order: present the result, mention any price change or missing item honestly, and let the shopper add what they want.",
      inputSchema: z.object({
        email: z.string().email().describe("The account email the shopper typed."),
        reference: z
          .string()
          .min(4)
          .max(40)
          .describe("Order reference from getOrderHistory, e.g. 'VCOD3F7B942A'."),
      }),
      execute: async ({ email, reference }) => {
        const denied = guardEmail(email, ctx);
        if (denied) return denied;

        const history = await fetchHistory(email, 10);
        if ("error" in history || "note" in history) return history;

        const wanted = reference.trim().toLowerCase();
        const order = history.orders.find((o) => o.reference.toLowerCase() === wanted);
        if (!order) {
          return {
            error: `No order ${reference} on this account. Show the shopper their recent orders (getOrderHistory) and ask which one they meant.`,
          };
        }

        const lines: Record<string, unknown>[] = [];
        const unavailable: Record<string, unknown>[] = [];

        for (const item of order.items) {
          const live = detailToSummary(
            await run("kapruka_get_product", { product_id: item.productId, currency: "LKR" }),
          );
          if (!live) {
            // Discontinued since the original order — genuinely gone from the catalogue.
            unavailable.push({
              productId: item.productId,
              name: item.name,
              reason: "no_longer_sold",
            });
            continue;
          }
          // Stash it so a follow-up addToCart/presentProducts resolves without a refetch.
          stashResults({ results: [live] });

          const nowPrice =
            live.price && typeof live.price === "object"
              ? ((live.price as { amount?: number }).amount ?? null)
              : null;
          const inStock = live.in_stock !== false;
          const entry = {
            productId: item.productId,
            // Prefer the live catalogue name, but run it through the same
            // cleaner — catalogue copy has its own quirks (stray backticks,
            // double spaces) that shouldn't reach a receipt.
            name: cleanProductName(live.name) || item.name,
            image: live.image_url ?? null,
            quantity: item.quantity,
            thenPrice: item.unitPrice,
            nowPrice,
            currency: item.currency || "LKR",
            inStock,
            priceChanged:
              item.unitPrice !== null && nowPrice !== null && Math.round(item.unitPrice) !== Math.round(nowPrice),
          };
          if (inStock) lines.push(entry);
          else unavailable.push({ ...entry, reason: "out_of_stock" });
        }

        if (!lines.length) {
          return {
            reference: order.reference,
            orderedAt: order.orderedAt,
            lines: [],
            unavailable,
            note: "Nothing from this order can be bought right now. Apologise briefly and offer to find similar items instead.",
          };
        }

        return {
          reference: order.reference,
          orderedAt: order.orderedAt,
          lines,
          unavailable,
          nowTotal: lines.reduce(
            (sum, l) => sum + ((l.nowPrice as number | null) ?? 0) * (l.quantity as number),
            0,
          ),
          currency: lines[0]?.currency ?? "LKR",
        };
      },
    }),
  };
}
