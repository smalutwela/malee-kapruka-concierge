/** Shared types mirroring the Kapruka MCP JSON shapes (response_format: "json"). */

export interface Money {
  amount: number | null;
  currency: string;
}

export interface ProductSummary {
  id: string;
  name: string;
  summary?: string;
  price?: Money;
  compare_at_price?: Money | null;
  in_stock?: boolean;
  stock_level?: string;
  image_url?: string | null;
  category?: { id: string; name: string; slug?: string };
  ships_internationally?: boolean;
  url?: string;
}

export interface SearchResults {
  results: ProductSummary[];
  next_cursor?: string | null;
  applied_filters?: Record<string, unknown>;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price?: Money;
  in_stock?: boolean;
  stock_level?: string;
  attributes?: Record<string, unknown>;
}

export interface ProductDetail {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  price?: Money;
  compare_at_price?: Money | null;
  in_stock?: boolean;
  stock_level?: string;
  category?: { id: string; name: string; slug?: string; path?: string };
  variants?: ProductVariant[];
  images?: string[];
  attributes?: { type?: string; subtype?: string; weight?: string; vendor?: string };
  shipping?: { ships_from?: string; ships_internationally?: boolean; restricted_countries?: string[] };
  url?: string;
}

export interface DeliveryQuote {
  city: string;
  now?: string;
  checked_date?: string;
  available: boolean;
  rate?: number;
  currency?: string;
  reason?: string | null;
  next_available_date?: string | null;
  perishable_warning?: string | null;
}

export interface OrderConfirmation {
  checkout_url: string;
  order_ref: string;
  summary: {
    items_total: number;
    delivery_fee: number;
    addons_total: number;
    grand_total: number;
    currency: string;
  };
  expires_at: string;
}

export interface OrderTracking {
  order_number: string;
  status: string;
  status_display?: string;
  order_date?: string;
  delivery_date?: string;
  /** Live API returns an object with a STRING value (e.g. {value:"4970",currency:"LKR"}). */
  amount?: string | { value?: string | number; currency?: string };
  /** Often junk (e.g. "0000") — only display when it reads like a word. */
  payment_method?: string;
  recipient?: { name: string; phone: string; address: string; city: string };
  greeting_message?: string | null;
  progress?: { step: string; timestamp: string }[];
  items?: {
    product_id: string;
    name: string;
    quantity: number;
    selling_price: number | string | { value?: string | number; currency?: string };
  }[];
}

export interface CategoryNode {
  name: string;
  url?: string;
  children?: CategoryNode[];
}
export interface CategoryList {
  categories: CategoryNode[];
}

/**
 * Shape of the createOrder tool *input* the model sends (camelCase — mirrors
 * the Zod schema in lib/agent/tools.ts). Read client-side from the tool part to
 * itemise the order card and capture order history.
 */
export interface CreateOrderToolInput {
  cart?: { productId: string; name?: string; quantity?: number; icingText?: string }[];
  recipient?: { name?: string; phone?: string };
  delivery?: { address?: string; city?: string; date?: string };
  sender?: { name?: string; anonymous?: boolean };
  giftMessage?: string;
}

/** Fallback shape for empty/error tool results. */
export interface ToolNote {
  note?: string;
  error?: string;
}
