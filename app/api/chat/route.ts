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

/**
 * Prepend a volatile <context> block (today's Colombo date) to the most recent
 * user turn. Keeping it out of the system prompt preserves the prompt cache.
 */
function withTurnContext(messages: ModelMessage[], context: string): ModelMessage[] {
  const out = [...messages];
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m.role !== "user") continue;
    const ctx = { type: "text" as const, text: `<context>\n${context}\n</context>` };
    out[i] = {
      ...m,
      content:
        typeof m.content === "string"
          ? [ctx, { type: "text", text: m.content }]
          : [ctx, ...m.content],
    };
    break;
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

  // colombo date + cart summary + (for si/ta) a "reply in this language" note,
  // plus a no-re-greet reminder once the chat is underway (the persona greets
  // once; smaller models otherwise re-greet every turn).
  const underway = messages.some((m) => m.role === "assistant");
  const context = [
    colomboContext(),
    cartContext(cart),
    profileContext(profile),
    localeContext(normalizeLocale(locale)),
    underway
      ? 'The conversation is already underway — do NOT greet or say "Ayubowan" again; reply straight to the point.'
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const converted = await convertToModelMessages(messages);
  const modelMessages: ModelMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
      // Cache the stable system prompt + tool definitions (tools render first).
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    ...withTurnContext(converted, context),
  ];

  const result = streamText({
    model: getAgentModel(),
    messages: modelMessages,
    tools: kaprukaTools,
    // Chain tool calls (search → detail → delivery → order) within one turn.
    stopWhen: stepCountIs(8),
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
