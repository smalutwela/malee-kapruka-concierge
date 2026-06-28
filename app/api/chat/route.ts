import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { kaprukaTools } from "@/lib/agent/tools";
import { SYSTEM_PROMPT, colomboContext, localeContext } from "@/lib/agent/prompt";
import { getAgentModel } from "@/lib/agent/model";
import { normalizeLocale } from "@/lib/i18n/config";

// Allow time for multi-step tool loops against the live MCP server.
export const maxDuration = 60;
export const runtime = "nodejs";

// ---- abuse guards (public demo: judges test daily; quota is finite) ----
// Per-IP sliding window. In-memory per warm instance — not bulletproof across
// instances, but it stops the realistic failure mode: one visitor (or script)
// burning the day's model quota in minutes.
const RATE_LIMIT = 12; // requests per window per IP
const RATE_WINDOW_MS = 60_000;
const rateLog = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    rateLog.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateLog.set(ip, hits);
  if (rateLog.size > 5000) {
    // Drop the oldest entries wholesale; precision doesn't matter at this size.
    for (const key of Array.from(rateLog.keys()).slice(0, 2500)) rateLog.delete(key);
  }
  return false;
}

const RATE_MESSAGE: Record<string, string> = {
  en: "Aiyo — you're a little too fast for me 🙏 Give it a few seconds and try again.",
  si: "අයියෝ — පොඩ්ඩක් වේගවත් වැඩියි 🙏 තත්පර කීපයකින් නැවත උත්සාහ කරන්න.",
  ta: "ஐயோ — கொஞ்சம் வேகம் அதிகம் 🙏 சில வினாடிகள் கழித்து மீண்டும் முயற்சிக்கவும்.",
};

// Global daily circuit breaker — a hard cap on total requests per UTC day, so a
// traffic spike (or one determined abuser rotating IPs) can't silently drain the
// API balance. In-memory per warm instance (resets on cold start) — it's a
// breaker, not bookkeeping. Default sits just above Gemini's own 500/day free
// tier, so on the free model the provider quota still bites first.
const DAILY_CAP = Number(process.env.DAILY_CHAT_CAP ?? 600);
let dayKey = "";
let dayCount = 0;

function dailyLimited(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    dayCount = 0;
  }
  if (dayCount >= DAILY_CAP) return true;
  dayCount += 1;
  return false;
}

const DAILY_MESSAGE: Record<string, string> = {
  en: "Malee has helped a LOT of shoppers today and is taking a rest 🌙 Please come back tomorrow!",
  si: "Malee අද ගොඩක් අයට උදව් කරලා දැන් පොඩ්ඩක් විවේක ගන්නවා 🌙 හෙට ආයෙත් එන්න!",
  ta: "Malee இன்று நிறைய பேருக்கு உதவிவிட்டு ஓய்வெடுக்கிறாள் 🌙 நாளை மீண்டும் வாருங்கள்!",
};

// Caps on what reaches the model: a long-running chat stays usable (the cards
// live in the browser transcript) while the model sees a bounded recent window.
const MAX_MODEL_MESSAGES = 30;
const MAX_TEXT_PART_CHARS = 4000;
const MAX_CART_LINES = 50;

/** Trim oversized text parts so a pasted novel can't blow up the token bill. */
function clampMessages(messages: UIMessage[]): UIMessage[] {
  return messages.slice(-MAX_MODEL_MESSAGES).map((m) => ({
    ...m,
    parts: m.parts.map((p) =>
      p.type === "text" && typeof p.text === "string" && p.text.length > MAX_TEXT_PART_CHARS
        ? { ...p, text: p.text.slice(0, MAX_TEXT_PART_CHARS) }
        : p,
    ),
  }));
}

/**
 * The volatile per-turn context (date, cart, saved details, locale steer) rides
 * as a SEPARATE trailing user message — never merged into the shopper's own
 * message and never in the system prompt. This keeps every historical message
 * byte-identical across turns, which is what makes the Anthropic history cache
 * (below) actually hit; on Gemini it reads the same as the old inline block.
 */
function contextMessage(context: string): ModelMessage {
  return {
    role: "user",
    content: [{ type: "text", text: `<context>\n${context}\n</context>` }],
  };
}

const CACHE_EPHEMERAL = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

/**
 * Anthropic multi-turn prompt caching: mark the last TWO user messages in the
 * (stable) converted history as cache breakpoints. Each turn, the older mark
 * sits at exactly the position the previous turn wrote its cache entry — a
 * guaranteed read of the whole history — while the newer mark writes the entry
 * the next turn will read. With the system-message breakpoint that's 3 of the
 * allowed 4. Inert on Gemini (providerOptions.anthropic is ignored).
 */
function withHistoryBreakpoints(messages: ModelMessage[]): ModelMessage[] {
  const out = [...messages];
  let marked = 0;
  for (let i = out.length - 1; i >= 0 && marked < 2; i--) {
    if (out[i].role !== "user") continue;
    out[i] = { ...out[i], providerOptions: CACHE_EPHEMERAL };
    marked += 1;
  }
  return out;
}

type CartLine = {
  id: string;
  name: string;
  quantity: number;
  price?: { amount: number | null; currency: string };
  icingText?: string;
};

function cartContext(cart?: CartLine[]): string {
  if (!cart?.length) return "The shopper's cart is currently empty.";
  const lines = cart.map(
    (i) =>
      `- ${i.quantity}× ${i.name} (product_id: ${i.id})` +
      (i.icingText ? ` [cake icing: "${i.icingText}"]` : "") +
      (i.price?.amount != null ? ` — Rs ${i.price.amount}` : ""),
  );
  return `The shopper's current cart — use these exact product_ids and quantities to create the order:\n${lines.join("\n")}`;
}

type Profile = { name?: string; phone?: string; address?: string; city?: string } | null;

/**
 * Saved contact + delivery details (browser-stored). Lets Malee skip re-asking
 * on a repeat/self purchase — the friction-killer Kapruka wants. She still must
 * confirm them and must collect fresh details for a gift to someone else.
 */
function profileContext(profile?: Profile): string {
  if (!profile) return "";
  const parts = [
    profile.name ? `Name: ${profile.name}` : "",
    profile.phone ? `Phone: ${profile.phone}` : "",
    profile.address ? `Address: ${profile.address}` : "",
    profile.city ? `City: ${profile.city}` : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  return `The shopper has saved details — for a repeat or self-purchase, offer to reuse them (let them confirm or change anything); for a gift to someone else, collect the recipient's details fresh:\n${parts.join("\n")}`;
}

export async function POST(req: Request) {
  const { messages, cart, locale, profile } = (await req.json()) as {
    messages: UIMessage[];
    cart?: CartLine[];
    locale?: string;
    profile?: Profile;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Invalid request.", { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimited(ip)) {
    return new Response(RATE_MESSAGE[normalizeLocale(locale)] ?? RATE_MESSAGE.en, {
      status: 429,
      headers: { "Retry-After": "30" },
    });
  }
  if (dailyLimited()) {
    return new Response(DAILY_MESSAGE[normalizeLocale(locale)] ?? DAILY_MESSAGE.en, {
      status: 429,
      headers: { "Retry-After": "3600" },
    });
  }

  // colombo date + cart summary + (for si/ta) a "reply in this language" note,
  // plus a no-re-greet reminder once the chat is underway (the persona greets
  // once; smaller models otherwise re-greet every turn).
  const underway = messages.some((m) => m.role === "assistant");
  const context = [
    colomboContext(),
    cartContext(cart?.slice(0, MAX_CART_LINES)),
    profileContext(profile),
    localeContext(normalizeLocale(locale)),
    underway
      ? 'The conversation is already underway — do NOT greet or say "Ayubowan" again; reply straight to the point.'
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const converted = await convertToModelMessages(clampMessages(messages), {
    // A clamped window can start mid-tool-loop; don't choke on orphaned calls.
    ignoreIncompleteToolCalls: true,
  });
  const modelMessages: ModelMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
      // Cache the stable system prompt + tool definitions (tools render first).
      providerOptions: CACHE_EPHEMERAL,
    },
    // Byte-stable history with trailing breakpoints, then the volatile context
    // last so it never invalidates the cached prefix.
    ...withHistoryBreakpoints(converted),
    contextMessage(context),
  ];

  // Hold the model reference so onFinish can read which provider actually served.
  // NOTE: `response.modelId` reports the fallback wrapper's PRIMARY id (always
  // "claude-…"), not the model that served — the wrapper looks like one model to
  // the SDK. The wrapper's own `.modelId` getter tracks the active model, so it
  // reflects a fallback that fired this turn.
  const model = getAgentModel();
  const result = streamText({
    model,
    messages: modelMessages,
    tools: kaprukaTools,
    // The system prompt rides in `messages` (not the `system` option) so it can
    // carry the Anthropic cacheControl breakpoint — acknowledged, not an accident.
    allowSystemInMessages: true,
    // Chain tool calls (search → present → detail → delivery → order) within one
    // turn; a multi-item grocery run needs search+present pairs per item.
    stopWhen: stepCountIs(12),
    // "claude-…" normally, or "gemini-…" when a Claude error tripped the fallback.
    // Token counts help eyeball Claude spend against the prepaid balance.
    onFinish: ({ totalUsage }) => {
      const served = typeof model === "string" ? model : model.modelId;
      console.log(
        `[model] served by ${served} · in/out tokens: ${totalUsage.inputTokens ?? "?"}/${totalUsage.outputTokens ?? "?"}`,
      );
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/quota|rate.?limit|429|exceeded|resource.?exhausted/i.test(msg)) {
        return "Aiyo — I'm getting a lot of requests right now 🙏 Please give me a few seconds and try again.";
      }
      console.error("chat stream error:", msg);
      return "Sorry, something hiccuped on my end. Please try again in a moment.";
    },
  });
}
