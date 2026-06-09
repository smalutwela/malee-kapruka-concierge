# CLAUDE.md — Malee developer guide

**Malee** is a full-screen AI shopping-concierge web app for the Kapruka Agent Challenge: a chat shopping experience over the **live Kapruka MCP server**, with rich product cards, a cart, and guided guest checkout (real click-to-pay links). The everyday shopper buying for themselves is the primary user; gifting is one prominent mode among many. This file orients developers — and AI sessions — on the architecture, conventions, and the non-obvious bits. User-facing setup/deploy lives in `README.md`.

## Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **Vercel AI SDK v6** (`ai`) with a provider-swappable model — `@ai-sdk/google` (default) or `@ai-sdk/anthropic`
- **Tailwind CSS v4** (CSS `@theme` tokens, no `tailwind.config`), `lucide-react`, **Zustand**
- A small, dependency-free **MCP client** (`lib/mcp.ts`) — JSON-RPC over Streamable HTTP

## Architecture / data flow
```
Browser  (components/chat.tsx, useChat)
  │  POST { messages, cart, locale }
  ▼
app/api/chat/route.ts   streamText(model, tools) · injects date+cart+locale context · graceful onError
  │  tool.execute()
  ▼
lib/agent/tools.ts      curated Zod tools  →  lib/mcp.ts  →  https://mcp.kapruka.com/mcp
```
Tool results stream back as typed UI parts; `components/chat.tsx` (`ToolView`) dispatches each to a card in `components/cards.tsx`.

## Key files
| Path | Responsibility |
|---|---|
| `app/api/chat/route.ts` | Chat endpoint: `streamText` + tool loop, per-turn date/cart context injection, graceful error mapping |
| `lib/agent/model.ts` | Provider/model selection via env (`AI_PROVIDER`, `AGENT_MODEL`) |
| `lib/agent/prompt.ts` | `SYSTEM_PROMPT` (Malee persona — a general shopping concierge with an opinion; gifting is one mode) + `colomboContext()` (per-turn date) + `localeContext()` (reply-language steer) |
| `lib/agent/tools.ts` | 7 curated tools (clean Zod schemas → MCP `params` envelope) |
| `lib/mcp.ts` | MCP client: session lifecycle, SSE parse, JSON unwrap, re-init, rate-limit signalling, **read-only response cache** |
| `lib/cart/store.ts` | Zustand cart (client-side source of truth), **persisted** to localStorage |
| `lib/profile/store.ts` | Persisted buyer details (name/phone/address/city) — reused to speed repeat checkout |
| `lib/orders/store.ts` + `orders/capture.ts` | Persisted local order history; `useCaptureOrders` records each placed order + seeds the profile |
| `lib/i18n/` | `config.ts` (locales `en`/`si`/`ta`, default + cookie name), `messages.ts` (en/si/ta dictionaries), `context.tsx` (`LocaleProvider` + `useT`/`useLocale`) |
| `components/locale-switcher.tsx` | Header language dropdown (English default, Sinhala, Tamil) |
| `lib/types.ts` | Types mirroring Kapruka JSON shapes |
| `lib/utils.ts` | `cn`, `formatPrice`, `resizeImage` (bumps the CDN `width=` segment) |
| `components/chat.tsx` | `ChatShell`, message rendering (assistant text via `RichText`), tool dispatch, welcome screen (shopping-mode chips), composer, cart + account drawers, store rehydration + order capture. In-progress tool calls render as a small team of **specialists** (`SPECIALIST` map → Shopper/Logistics) |
| `components/cards.tsx` | Product / delivery / order / tracking cards + `AddToCart`, `SmartImage` |
| `components/account-drawer.tsx` | Saved-details editor + order history with one-tap **Reorder** / Pay / Track |
| `components/rich-text.tsx` | Dependency-free inline Markdown-lite formatter (bold/italic/links) for Malee's chat messages — no Markdown library. Only http(s)/mailto links are linkified; a `[label](PRODUCT_ID)` from the model renders as just the label |
| `app/globals.css` | Tailwind v4 theme tokens (Light/Dark/Warm; Light default = Kapruka brand palette) + animations + per-locale Sinhala/Tamil font stacks (`html[data-locale=…]`) |
| `scripts/mcp-smoke.ts` | Live MCP integration test (`npm run mcp:test`) |

## Kapruka MCP — read before touching tools
- Endpoint `https://mcp.kapruka.com/mcp`, Streamable HTTP, **no auth**. Free tier ~60 req/min; `create_order` 30/hr.
- Every tool call nests args under a **`params`** object, and we force `response_format: "json"`. Results arrive as a JSON *string* in `result.content[0].text`; `callTool` returns `{ json, text }`.
- **Search quirk:** the catalog files most items under a generic `General` category, so a `category` filter frequently returns nothing. `searchProducts` searches keywords-first and **auto-retries without the category** when empty (`isEmptyResult`), **dedupes results by id** (`dedupeById` — the catalogue sometimes returns the same product twice, colliding on React's `key`), and **drops total-mismatch result sets** (`dropIrrelevant`). Kapruka's search is fuzzy: a rare/over-specific query (e.g. `"samba rice"`) returns unrelated popular items (chocolate hampers) that would render as cards verbatim — so when no result shares a meaningful whole word with the query, the tool returns empty + a note and the model retries simpler. It also **strips product `url`s** from search results (`stripResultUrls`) so a weak model can't paste deep product links in chat — the cards link out instead (getProduct keeps its url for the detail card). Prefer **simple product nouns for staples**, short descriptive phrases for distinctive gifts.
- **`create_order` is a REAL transaction** — it mints a guest order + click-to-pay link (no money moves until someone pays). Test only with explicit authorization: `npm run mcp:test -- --order`. The persona must show an order summary and get explicit confirmation before calling it.
- **Response caching:** read-only tools are cached in-memory with a per-tool TTL (`READ_TTL_MS` in `lib/mcp.ts` — categories/cities 30 min, `get_product` 5 min, `search_products` 2 min), so repeat calls skip the network and the rate limit (Kapruka explicitly asks clients to cache). `create_order`/`track_order` are absent from the map, so never cached. The cache is module-scoped (per warm server instance).

## AI provider & model
- Swap via env (`lib/agent/model.ts`): `AI_PROVIDER=google` (default) | `anthropic`; optional `AGENT_MODEL` to pin a model.
- Default **`gemini-3.1-flash-lite`** — the most generous Gemini free tier (15 RPM / 500 RPD; 2.5-flash is only 5 RPM / 20 RPD). Switch to Claude with `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (default `claude-sonnet-4-6`).
- **Anthropic prompt caching:** the leading system message carries `cacheControl: ephemeral` (inert on Gemini). Keep `SYSTEM_PROMPT` byte-stable — volatile context (date, cart) is injected into the **last user message**, never the system prompt, so the cached `tools`+`system` prefix stays valid.
- Rate-limit/quota errors map to a friendly "try again" message in the route's `onError`; `stopWhen: stepCountIs(8)` caps model calls per turn.

## Cart, profile & order history (client-owned, persisted)
- Three Zustand stores persist to localStorage (`malee-cart`, `malee-profile`, `malee-orders`). They set `skipHydration` so the first client render matches the SSR HTML; `ChatShell` calls each store's `persist.rehydrate()` once on mount (badges fill a tick after paint — no hydration mismatch).
- The cart is client-owned (`lib/cart/store.ts`); "Add to cart" fills it and the drawer manages quantities. Each turn the client sends `cart` **and the saved `profile`** in the request body; the route injects a compact cart summary + a saved-details block (+ today's Colombo date) into the latest user turn, so Malee knows what to order and can offer to reuse the shopper's details (she still confirms, and collects fresh details for a gift to someone else). Checkout builds `create_order` from those `product_id`s.
- The order-confirmation card (`OrderSummaryCard`) itemises quantities from a **snapshot of the cart taken when it mounts** — `create_order` returns totals only, no line items. Snapshot (not live) so later cart edits never rewrite an order that's already placed.
- **Order history + reorder:** `useCaptureOrders` (run in `ChatShell`) watches the transcript and, when a `createOrder` tool part returns a pay link, records the order — items taken from the tool *input* (authoritative) and enriched with name/price/image from the live cart — into `lib/orders/store.ts` (deduped by `order_ref`), and **seeds** the profile if it's empty. The account drawer lists past orders with one-tap **Reorder** (refills the cart, opens it), Pay (while the 60-min link is live), and Track. The MCP has no "list orders" or order-edit tool, so history is browser-only and a placed order can't be modified — only tracked (the persona is told this).

## Localization (i18n)
- Three locales — **English (default)**, **Sinhala (සිංහල)**, **Tamil (தமிழ்)**. No URL routing (`/si`, `/ta`): Malee is a single-screen client app, so locale is a **cookie** (`malee-locale`) read in the root layout and switched live on the client. Reading the cookie makes `/` dynamically rendered — an accepted trade-off for SSR-correct language (no flash, correct `<html lang>`).
- UI strings live in `lib/i18n/messages.ts` (`en` is the typed source of truth; `si`/`ta` must match its shape). Components read them via `useT()`; interpolated strings are small functions. Quick-action chips (shopping-mode/example/details/delivery/category/checkout) are localized too, since they post to Malee as the shopper's words.
- **Not translated:** live catalogue data (product names, categories, cities) and proper nouns (Malee, Kapruka, Avurudu, Ayubowan, "Rs") — the Kapruka catalogue is English.
- **Reply language:** the client sends `locale` each turn; `localeContext()` steers Malee to greet/reply in Sinhala/Tamil by default (English needs no steer). The shopper's actually-typed language always wins — see the persona "Voice" rules.
- Sinhala/Tamil glyphs use a system/Noto font stack (brand Latin font first) — no extra web fonts bundled.

## Dev workflow
```bash
npm install
cp .env.example .env.local        # add GOOGLE_GENERATIVE_AI_API_KEY
npm run dev                       # http://localhost:3210  (3210 avoids a local :3000 conflict)
npm run mcp:test                  # live MCP read-only chain ( -- --order to exercise create_order )
npm run typecheck && npm run lint
npm run build
```
Deploy: Vercel (`vercel --prod`); set `GOOGLE_GENERATIVE_AI_API_KEY` in the project's env vars. Full steps in `README.md`.

## Conventions
- **Commits are authored only by the user.**
- **Git hooks (husky):** `pre-commit` runs `typecheck` + `lint` (fast, high-signal); `pre-push` runs the full `build` (mirrors the Vercel build, so it runs once per push, not per commit). They self-install via the `prepare` script on `npm install`. Bypass for WIP with `git commit --no-verify` / `git push --no-verify`.
- **Keep docs in step:** when a change adds/renames a module or alters documented behavior, architecture, or a convention, update `CLAUDE.md` in the **same commit** (and `README.md` for setup/deploy/env changes). Trigger-based, not a gate — most commits don't need it.
- `.env*` is gitignored (except `.env.example`); never commit secrets. `.claude/settings.local.json` is ignored too.
- **Add a tool:** define it in `lib/agent/tools.ts` (Zod schema + `execute` → `run("kapruka_…")`), then render its result in `components/chat.tsx` `ToolView` and add a card to `components/cards.tsx`.
- **Tweak the persona:** edit `SYSTEM_PROMPT` in `lib/agent/prompt.ts`.
- **Add a UI string:** add the key to `en` in `lib/i18n/messages.ts` (TS then forces `si`/`ta` to match), and read it with `useT()`. **Add a locale:** extend `LOCALES`/`LOCALE_META` in `lib/i18n/config.ts`, add the dictionary, and (optionally) a font stack in `app/globals.css`.

## Framework note
@AGENTS.md
