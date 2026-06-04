import { tool } from "ai";
import { z } from "zod";
import { callTool, McpError } from "@/lib/mcp";

/**
 * Curated tools exposed to Claude. Each has a clean, flat schema (no `params`
 * wrapper — the MCP client adds that) and a prescriptive description. Executors
 * translate camelCase → the MCP snake_case fields, default currency to LKR, and
 * return parsed JSON for both the model and the UI to render.
 */

async function run(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const { json, text } = await callTool(name, args);
    if (json !== null) return json;
    // Empty result / server-side validation message comes back as plain text.
    return { note: text || "No data returned." };
  } catch (err) {
    if (err instanceof McpError) {
      return { error: err.message, code: err.code ?? null };
    }
    return { error: err instanceof Error ? err.message : "Unexpected error calling Kapruka." };
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

const currency = z
  .string()
  .default("LKR")
  .describe("Pricing currency: LKR (default), USD, GBP, AUD, CAD, EUR.");

export const kaprukaTools = {
  searchProducts: tool({
    description:
      "Search Kapruka's live catalogue. Call this whenever the shopper wants to find or browse gifts. Use specific, descriptive queries (e.g. 'red roses bouquet', 'birthday chocolate box') rather than single vague words — vague queries can return nothing. Results render as product cards in the UI.",
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
      return res;
    },
  }),

  getProduct: tool({
    description:
      "Fetch full details for one product by its ID (from a search result). Use when the shopper wants more detail, images, variants, or to confirm stock before adding to an order.",
    inputSchema: z.object({
      productId: z.string().min(3).describe("Kapruka product ID, e.g. 'FLOWERS00T2075'."),
      currency,
    }),
    execute: ({ productId, currency }) =>
      run("kapruka_get_product", { product_id: productId, currency }),
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
      "Look up the status and delivery progress of a Kapruka order by its order number (from the confirmation email after payment — NOT the pre-payment order_ref).",
    inputSchema: z.object({
      orderNumber: z.string().min(4).max(40).describe("Kapruka order number, e.g. 'VIMP34456CB2'."),
    }),
    execute: ({ orderNumber }) => run("kapruka_track_order", { order_number: orderNumber }),
  }),
};
