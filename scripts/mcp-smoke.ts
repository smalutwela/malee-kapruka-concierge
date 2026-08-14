/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Live smoke test for the Kapruka MCP client.
 *
 *   npm run mcp:test           # read-only chain (categories, search, product, delivery)
 *   npm run mcp:test -- --order  # also creates one real (unpaid) guest order + pay link
 *
 * Creating an order is safe: it only mints a click-to-pay URL; no money moves
 * until a human opens the link and pays. It counts against the 30 orders/hr limit.
 *
 * When KAPRUKA_ACCESS_TOKEN is set (see .env.local), the Phase 2 customer tools
 * are exercised too — including the normalizers, which are what stand between
 * the backend's raw payloads and the UI.
 */
import { config as loadEnv } from "dotenv";
import { callTool, type ToolResult } from "../lib/mcp";
import {
  normalizeAddresses,
  normalizeCustomer,
  normalizeOrderHistory,
} from "../lib/account/normalize";

loadEnv({ path: ".env.local", quiet: true });

function section(title: string) {
  console.log(`\n${"=".repeat(64)}\n${title}\n${"=".repeat(64)}`);
}

function colomboDatePlus(daysAhead = 0): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + daysAhead);
  return dt.toISOString().slice(0, 10);
}

function unwrap(res: ToolResult, label: string): any {
  if (res.json === null) {
    console.log(`  ⚠ ${label}: non-JSON response -> ${res.text.slice(0, 120)}`);
    return null;
  }
  return res.json;
}

/** The account email the preview backend serves data for. */
const TEST_EMAIL = "sandaru.perera@gmail.com";

function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/**
 * Phase 2 customer tools. Beyond "did it respond", this asserts the
 * normalizers actually scrub the backend's artefacts — the "<BR" welded to every
 * phone number, ALL-CAPS names, junk in product names, and the duplicate
 * addresses. Those are silent-regression territory, so they get real assertions.
 */
async function phase2(): Promise<void> {
  const token = process.env.KAPRUKA_ACCESS_TOKEN;
  section("6. Phase 2 customer tools (private preview)");
  if (!token) {
    console.log("  ⚠ KAPRUKA_ACCESS_TOKEN not set — skipping. Add it to .env.local to cover these.");
    return;
  }
  const args = { email: TEST_EMAIL, access_token: token };

  const customer = normalizeCustomer(unwrap(await callTool("kapruka_customer_details", args), "customer"), TEST_EMAIL);
  console.log(`  customer: ${customer?.fullName} · ${customer?.phone} · ${customer?.language}`);
  check("profile parsed", Boolean(customer?.fullName));
  check("phone has no HTML scrap", !/[<>]/.test(customer?.phone ?? ""), customer?.phone ?? "");

  const history = normalizeOrderHistory(
    unwrap(await callTool("kapruka_order_history", { ...args, limit: 10 }), "history"),
  );
  const orders = history?.orders ?? [];
  console.log(`  orders: ${orders.length}`);
  for (const o of orders.slice(0, 3)) {
    console.log(`    ${o.reference} ${o.statusLabel} ${o.orderedAt} → ${o.deliveryDate} · ${o.items.length} item(s)`);
  }
  check("order history parsed", orders.length > 0);
  check(
    "order dates are ISO",
    orders.every((o) => !o.orderedAt || /^\d{4}-\d{2}-\d{2}$/.test(o.orderedAt)),
  );
  const names = orders.flatMap((o) => o.items.map((i) => i.name));
  check("product names are clean", !names.some((n) => /\.jpg|#[A-Z]{3,}|`|^\w+\[/i.test(n)));
  check(
    "recipient phones are clean",
    !orders.some((o) => /[<>]/.test(o.recipient?.phone ?? "")),
  );

  const book = normalizeAddresses(
    unwrap(await callTool("kapruka_customer_addresses", args), "addresses"),
    TEST_EMAIL,
    customer?.fullName ?? null,
  );
  const addresses = book?.addresses ?? [];
  for (const a of addresses) console.log(`    [${a.saved ? "saved " : "recent"}] ${a.label}: ${a.address}, ${a.city}`);
  check("addresses parsed", addresses.length > 0);
  check("addresses de-duplicated", new Set(addresses.map((a) => `${a.name}|${a.address}|${a.city}`.toLowerCase())).size === addresses.length);
  check("a home/office label was inferred", addresses.some((a) => a.label === "Home" || a.label === "Office"));

  // The lookup must fail closed for any other account.
  const denied = await callTool("kapruka_customer_details", { ...args, email: "not.a.customer@example.com" });
  check("unknown email is refused by the server", /error/i.test(String(denied.json ?? denied.text)));
}

async function main() {
  const runOrder = process.argv.includes("--order");

  section("1. list_categories");
  const cats = unwrap(await callTool("kapruka_list_categories", { depth: 1 }), "categories");
  const catNames: string[] = (cats?.categories ?? []).map((c: any) => c.name);
  console.log(`  ${catNames.length} categories. Sample: ${catNames.slice(0, 8).join(", ")}`);

  section("2. search_products  q='roses'  (in stock, limit 5)");
  const search = unwrap(
    await callTool("kapruka_search_products", { q: "red roses bouquet", limit: 5, in_stock_only: true }),
    "search",
  );
  const results: any[] = search?.results ?? [];
  results.forEach((r, i) =>
    console.log(`  [${i}] ${r.id}  ${r.price?.currency} ${r.price?.amount}  ${r.name?.slice(0, 48)}`),
  );
  if (!results.length) throw new Error("Expected at least one search result for roses");
  const product = results[0];

  section(`3. get_product  id='${product.id}'`);
  const detail = unwrap(await callTool("kapruka_get_product", { product_id: product.id }), "product");
  console.log(`  name:     ${detail?.name}`);
  console.log(`  price:    ${detail?.price?.currency} ${detail?.price?.amount}`);
  console.log(`  in_stock: ${detail?.in_stock} (${detail?.stock_level})`);
  console.log(`  images:   ${detail?.images?.length ?? 0}  first: ${detail?.images?.[0]?.slice(0, 70)}`);
  console.log(`  variants: ${detail?.variants?.length ?? 0}`);

  section("4. list_delivery_cities  query='colombo'");
  const cities = unwrap(await callTool("kapruka_list_delivery_cities", { query: "colombo", limit: 8 }), "cities");
  const cityNames: string[] = (cities?.cities ?? []).map((c: any) => c.name);
  console.log(`  ${cities?.total_matched} matched. Sample: ${cityNames.slice(0, 6).join(", ")}`);
  const city = cityNames[0] ?? "Colombo 03";

  const deliveryDate = colomboDatePlus(2);
  section(`5. check_delivery  city='${city}'  date='${deliveryDate}'`);
  const delivery = unwrap(
    await callTool("kapruka_check_delivery", { city, delivery_date: deliveryDate, product_id: product.id }),
    "delivery",
  );
  console.log(`  available: ${delivery?.available}`);
  console.log(`  rate:      ${delivery?.currency} ${delivery?.rate}`);
  if (delivery?.reason) console.log(`  reason:    ${delivery.reason}`);
  if (delivery?.perishable_warning) console.log(`  ⚠ perishable: ${delivery.perishable_warning}`);

  await phase2();

  if (!runOrder) {
    section("DONE (read-only). Re-run with `-- --order` to exercise create_order.");
    return;
  }

  section("7. create_order  (real guest checkout link)");
  const order = unwrap(
    await callTool("kapruka_create_order", {
      cart: [{ product_id: product.id, quantity: 1 }],
      recipient: { name: "Smoke Test Recipient", phone: "0771234567" },
      delivery: { address: "123 Galle Road", city, date: deliveryDate, location_type: "house" },
      sender: { name: "Malee Smoke Test", anonymous: false },
      gift_message: "Automated smoke test — please ignore.",
    }),
    "order",
  );
  console.log(`  order_ref:    ${order?.order_ref}`);
  console.log(`  grand_total:  ${order?.summary?.currency} ${order?.summary?.grand_total}`);
  console.log(`  expires_at:   ${order?.expires_at}`);
  console.log(`  checkout_url: ${order?.checkout_url}`);
  if (!order?.checkout_url) throw new Error("create_order did not return a checkout_url");

  section("DONE (full end-to-end incl. create_order).");
}

main().catch((err) => {
  console.error("\n❌ Smoke test failed:");
  console.error(err);
  process.exit(1);
});
