import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { kaprukaTools } from "@/lib/agent/tools";
import { SYSTEM_PROMPT, colomboContext } from "@/lib/agent/prompt";
import { getAgentModel } from "@/lib/agent/model";

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
  if (!cart?.length) return "The shopper's gift cart is currently empty.";
  const lines = cart.map(
    (i) =>
      `- ${i.quantity}× ${i.name} (product_id: ${i.id})` +
      (i.icingText ? ` [cake icing: "${i.icingText}"]` : "") +
      (i.price?.amount != null ? ` — Rs ${i.price.amount}` : ""),
  );
  return `The shopper's current gift cart — use these exact product_ids and quantities to create the order:\n${lines.join("\n")}`;
}

export async function POST(req: Request) {
  const { messages, cart } = (await req.json()) as { messages: UIMessage[]; cart?: CartLine[] };

  const context = `${colomboContext()}\n\n${cartContext(cart)}`;
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
    // Let Claude chain tool calls (search → detail → delivery → order) in one turn.
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
}
