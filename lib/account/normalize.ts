/**
 * Normalizers for the Phase 2 customer tools (private preview).
 *
 * These three tools read straight out of Kapruka's order system, so their
 * payloads carry a decade of storage artefacts that neither the model nor the
 * cards should ever see. Verified live against the test account:
 *
 *   - keys contain spaces          "full name", "order date", "unit price"
 *   - phones carry an HTML scrap   "0774354351<BR"
 *   - addresses carry a marker     "4, CHURCH ROAD, HATTON LT-HOUSE OR RESIDENCE-"
 *   - names/addresses are SHOUTY   "ANN SMITH", "NO.123, UDAHAMULLA ROAD"
 *   - product names carry junk     "… MessageID 1785755767113.jpg", "CGRT[HAPPY
 *                                  BIRTHDAY TO YOU]Love Struck …", "… #ADDONGC"
 *   - "no message" is a sentinel   "NO PERSONAL MESSAGE"
 *   - money is a string            {"value": "1220.80", "currency": "LKR"}
 *   - dates are Java toString()    "Mon Aug 03 07:18:12 EDT 2026"
 *     or a spaced slash format     "1 / MARCH / 2027"
 *
 * Everything here runs server-side, inside the tool executors, so the cleaned
 * shape is all that ever crosses the wire.
 */

import type {
  AccountOrder,
  AccountOrderHistory,
  AccountOrderItem,
  AddressBook,
  CustomerProfile,
  SavedAddress,
} from "@/lib/types";

/* ----------------------------- primitives ----------------------------- */

/** Placeholders the backend uses for "nothing here". */
const BLANKS = new Set(["", "na", "n/a", "-", "--", "*", "null", "none", "0000"]);

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}

/** Trimmed string, with the backend's placeholder values collapsed to null. */
function text(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const clean = stripHtmlScraps(value).trim();
  return BLANKS.has(clean.toLowerCase()) ? null : clean;
}

/**
 * Strip HTML fragments the legacy fields leak — notably the unterminated "<BR"
 * that ends every phone number in order history and tracking.
 */
function stripHtmlScraps(s: string): string {
  return s.replace(/<\s*\/?\s*br\s*\/?\s*>?/gi, " ").replace(/\s+/g, " ").trim();
}

/**
 * Title-case a value only when it is SHOUTY (no lowercase letters at all).
 * Address-book entries are already sensibly cased, so they pass through
 * untouched; only the ALL-CAPS order-system copies get softened.
 * "NO.123, UDAHAMULLA ROAD" -> "No.123, Udahamulla Road"
 */
function softenCaps(value: string | null): string | null {
  if (!value) return value;
  if (/[a-z]/.test(value)) return value;
  return value.toLowerCase().replace(/[a-z]+/g, (w) => w[0].toUpperCase() + w.slice(1));
}

/** Money arrives as {value: "1220.80", currency: "LKR"} — or occasionally a bare number. */
function amount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value === "object") {
    return amount((value as { value?: unknown }).value);
  }
  return null;
}

function currencyOf(value: unknown, fallback = "LKR"): string {
  if (value && typeof value === "object") {
    const c = (value as { currency?: unknown }).currency;
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return fallback;
}

/* -------------------------------- dates -------------------------------- */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse either backend date format to a plain ISO calendar date.
 *
 * We deliberately keep the wall-clock date rather than converting timezones:
 * the backend stamps orders in US/Eastern while the shopper reads them in
 * Colombo, and "the date Kapruka shows on the order" is the useful truth here.
 * Returns null rather than guessing when the format is unrecognised.
 */
export function parseKaprukaDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  // "Mon Aug 03 07:18:12 EDT 2026"  (java.util.Date#toString)
  const java = raw.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+[\d:]+\s+\S+\s+(\d{4})$/);
  if (java) {
    const month = MONTHS[java[1].toLowerCase()];
    return iso(Number(java[3]), month, Number(java[2]));
  }

  // "1 / MARCH / 2027"
  const slashed = raw.match(/^(\d{1,2})\s*\/\s*([A-Za-z]+)\s*\/\s*(\d{4})$/);
  if (slashed) {
    const month = MONTHS[slashed[2].slice(0, 3).toLowerCase()];
    return iso(Number(slashed[3]), month, Number(slashed[1]));
  }

  // Already ISO.
  const already = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (already) return `${already[1]}-${already[2]}-${already[3]}`;

  return null;
}

/* ---------------------------- product names ---------------------------- */

/**
 * Order-history product names carry storage junk that the live catalogue has
 * already cleaned up. Strip it so the receipt reads like a product, not a row.
 */
export function cleanProductName(value: unknown): string {
  let name = text(value) ?? "";
  name = name
    // "CGRT[HAPPY BIRTHDAY TO YOU]Love Struck Heart Shape Gateau Cake"
    .replace(/^[A-Z]{2,8}\[[^\]]*\]\s*/, "")
    // "Message In a Bottle   MessageID 1785755767113.jpg"
    .replace(/\s*MessageID\s+\S+\s*$/i, "")
    // any other trailing image filename
    .replace(/\s*\S+\.(?:jpe?g|png|webp|gif)\s*$/i, "")
    // "Adarei Ahasa Tharam Greeting Card #ADDONGC"
    .replace(/\s*#[A-Za-z0-9_-]+\s*$/, "")
    // "Java `Love Bites`Lip Chocolates" -> "Java 'Love Bites' Lip Chocolates"
    .replace(/`([^`]*)`/g, "'$1' ")
    .replace(/\s+/g, " ")
    .trim();
  return name;
}

/** "NO PERSONAL MESSAGE" and friends mean "there wasn't one". */
const MESSAGE_SENTINELS = new Set([
  "no personal message",
  "no message",
  "no greeting message",
  "none",
]);

function giftMessage(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return MESSAGE_SENTINELS.has(raw.toLowerCase()) ? null : raw;
}

/* ------------------------------- statuses ------------------------------- */

export function statusKey(value: unknown): string {
  const raw = text(value) ?? "";
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown";
}

function statusLabel(value: unknown): string {
  return softenCaps(text(value)) ?? "Unknown";
}

/* ------------------------------- profile ------------------------------- */

export function normalizeCustomer(raw: unknown, fallbackEmail: string): CustomerProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const c = (root.customer ?? root) as Record<string, unknown>;
  if (!c || typeof c !== "object") return null;

  const billingRaw = (c.billing ?? {}) as Record<string, unknown>;
  const billingPhone = text(pick(billingRaw, "phone", "mobile"));

  const billing = {
    name: softenCaps(text(pick(billingRaw, "name"))),
    address: softenCaps(text(pick(billingRaw, "address"))),
    city: softenCaps(text(pick(billingRaw, "city"))),
    postcode: text(pick(billingRaw, "zip", "postcode", "postal code")),
    country: softenCaps(text(pick(billingRaw, "country"))),
    phone: billingPhone,
  };
  const hasBilling = Object.values(billing).some(Boolean);

  return {
    email: text(pick(c, "email")) ?? fallbackEmail,
    fullName: softenCaps(text(pick(c, "full name", "fullName", "name"))),
    firstName: softenCaps(text(pick(c, "first name", "firstName"))),
    lastName: softenCaps(text(pick(c, "last name", "lastName"))),
    // The account's own phone field is often empty; billing carries the real one.
    phone: text(pick(c, "phone", "mobile")) ?? billingPhone,
    language: softenCaps(text(pick(c, "language"))),
    billing: hasBilling ? billing : null,
  };
}

/* ---------------------------- order history ---------------------------- */

function normalizeOrderItem(raw: unknown): AccountOrderItem | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const productId = text(pick(i, "product id", "product_id", "productId", "id"));
  if (!productId) return null;

  const unit = pick(i, "unit price", "unit_price", "unitPrice", "selling price", "selling_price");
  const line = pick(i, "line total", "line_total", "lineTotal");
  const quantity = Number(pick(i, "quantity", "qty") ?? 1) || 1;
  const unitPrice = amount(unit);

  return {
    productId,
    name: cleanProductName(pick(i, "name", "title")),
    quantity,
    unitPrice,
    lineTotal: amount(line) ?? (unitPrice !== null ? unitPrice * quantity : null),
    currency: currencyOf(unit, currencyOf(line)),
  };
}

function normalizeOrder(raw: unknown): AccountOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const reference = text(pick(o, "reference", "order_number", "order number", "orderRef"));
  if (!reference) return null;

  const recipientRaw = (o.recipient ?? {}) as Record<string, unknown>;
  const recipient = {
    name: softenCaps(text(pick(recipientRaw, "name"))),
    phone: text(pick(recipientRaw, "phone", "mobile")),
    address: softenCaps(stripLocationMarker(text(pick(recipientRaw, "address")))),
    city: softenCaps(text(pick(recipientRaw, "city"))),
  };

  const total = pick(o, "amount", "total");
  const items = Array.isArray(o.items)
    ? (o.items.map(normalizeOrderItem).filter(Boolean) as AccountOrderItem[])
    : [];

  return {
    reference,
    statusKey: statusKey(pick(o, "status")),
    statusLabel: statusLabel(pick(o, "status_display", "status")),
    total: amount(total),
    currency: currencyOf(total),
    orderedAt: parseKaprukaDate(pick(o, "order date", "order_date", "orderedAt")),
    deliveryDate: parseKaprukaDate(pick(o, "delivery date", "delivery_date", "deliveryDate")),
    recipient: Object.values(recipient).some(Boolean) ? recipient : null,
    giftMessage: giftMessage(pick(o, "greeting message", "greeting_message", "giftMessage")),
    instructions: text(pick(o, "special instructions", "special_instructions", "instructions")),
    items,
  };
}

export function normalizeOrderHistory(raw: unknown): AccountOrderHistory | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const list = Array.isArray(root.orders) ? root.orders : null;
  if (!list) return null;
  const orders = list.map(normalizeOrder).filter(Boolean) as AccountOrder[];
  return { orders, count: orders.length };
}

/* ------------------------------ addresses ------------------------------ */

/**
 * Tracking/history addresses carry a trailing location-type marker the order
 * system appends: "4, CHURCH ROAD, HATTON LT-HOUSE OR RESIDENCE-".
 */
export function stripLocationMarker(value: string | null): string | null {
  if (!value) return value;
  return value.replace(/\s*LT-[A-Z\s]+-\s*$/i, "").trim() || null;
}

/** Same doorstep? Compare on who + where, ignoring case, punctuation and phone. */
function addressKey(name: string, address: string, city: string): string {
  return [name, address, city]
    .join("|")
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "");
}

/**
 * Guess what the shopper would *call* this address, so Malee can honour
 * "send it to my home address" instead of reciting the street.
 */
function addressLabel(name: string, ownerName: string | null): string {
  const n = name.toLowerCase();
  if (/\boffice\b|\bwork\b/.test(n)) return "Office";
  if (ownerName && n === ownerName.toLowerCase()) return "Home";
  return name;
}

export function normalizeAddresses(
  raw: unknown,
  email: string,
  ownerName: string | null = null,
): AddressBook | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;

  const book = Array.isArray(pick(root, "address book", "address_book", "addressBook"))
    ? (pick(root, "address book", "address_book", "addressBook") as unknown[])
    : [];
  const recent = Array.isArray(pick(root, "recent delivery addresses", "recent_delivery_addresses"))
    ? (pick(root, "recent delivery addresses", "recent_delivery_addresses") as unknown[])
    : [];

  const addresses: SavedAddress[] = [];
  const seen = new Set<string>();

  const take = (entry: unknown, saved: boolean, index: number) => {
    if (!entry || typeof entry !== "object") return;
    const a = entry as Record<string, unknown>;
    const name = softenCaps(text(pick(a, "name", "recipient"))) ?? "";
    const address = softenCaps(stripLocationMarker(text(pick(a, "address")))) ?? "";
    const city = softenCaps(text(pick(a, "city"))) ?? "";
    if (!address || !city) return;

    // The recent list repeats the address book (and itself) — collapse on the
    // doorstep, keeping the first (saved entries are taken first, then most
    // recent), so the shopper sees each place exactly once.
    const key = addressKey(name, address, city);
    if (seen.has(key)) return;
    seen.add(key);

    addresses.push({
      id: text(pick(a, "id")) ?? `${saved ? "saved" : "recent"}-${index}`,
      label: addressLabel(name, ownerName),
      name,
      address,
      city,
      phone: text(pick(a, "mobile", "phone")),
      saved,
    });
  };

  book.forEach((e, i) => take(e, true, i));
  recent.forEach((e, i) => take(e, false, i));

  return { email, addresses };
}
