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
| `app/api/chat/route.ts` | Chat endpoint: `streamText` + tool loop, per-turn date/cart/account context injection, graceful error mapping, **per-IP rate limit** (12/min, localized 429) + message/cart clamping (public-demo abuse guards). Builds the **account-email allowlist** and the per-request account tools |
| `lib/agent/model.ts` | Provider/model selection via env (`AI_PROVIDER`, `AGENT_MODEL`) |
| `lib/agent/prompt.ts` | `SYSTEM_PROMPT` (Malee persona — a general shopping concierge with an opinion; gifting is one mode) + `colomboContext()` (per-turn date) + `localeContext()` (reply-language steer) |
| `lib/agent/tools.ts` | 9 curated catalogue/checkout tools + `buildAccountTools()` (4 more, per-request — see "Kapruka account" below). Clean Zod schemas → MCP `params` envelope. **Search results are private to the model** — only `presentProducts` (model-picked ids, served from a per-instance result stash with a `get_product` fallback) renders product cards. `addToCart` resolves the item server-side (stash → cached `get_product` — never model-typed data) and returns it with a unique `addId`. `run()` maps error/empty text to `{error}`/`{note}` and **redacts the access token** from any message |
| `lib/account/normalize.ts` | Scrubs the Phase 2 payloads (see "Kapruka account") — keys-with-spaces, `<BR` in phones, ALL-CAPS names, junk product names, Java date strings, duplicate addresses — into the clean shapes in `lib/types.ts`. Server-side only |
| `lib/account/store.ts` + `account/capture.ts` | Persisted signed-in email + cached display name (`malee-account`); `useCaptureAccount` caches the name from a profile lookup and **fills blank** checkout details from the account (never overwrites the shopper's own edits) |
| `lib/mcp.ts` | MCP client: session lifecycle, SSE parse, JSON unwrap, re-init, rate-limit signalling, **read-only response cache** |
| `lib/cart/store.ts` + `cart/capture.ts` | Zustand cart (client-side source of truth), **persisted** to localStorage; `useCaptureCartAdds` applies each agent `addToCart` result to the store exactly once (persisted `seenAdds` set, keyed by `addId` — a restored transcript never re-adds removed items) |
| `lib/profile/store.ts` | Persisted buyer details (name/phone/address/city) — reused to speed repeat checkout |
| `lib/orders/store.ts` + `orders/capture.ts` | Persisted local order history; `useCaptureOrders` records each placed order + seeds the profile |
| `lib/i18n/` | `config.ts` (locales `en`/`si`/`ta`, default + cookie name), `messages.ts` (en/si/ta dictionaries), `context.tsx` (`LocaleProvider` + `useT`/`useLocale`) |
| `components/locale-switcher.tsx` | Header language dropdown (English default, Sinhala, Tamil) |
| `lib/types.ts` | Types mirroring Kapruka JSON shapes |
| `lib/utils.ts` | `cn`, `formatPrice`, `resizeImage` (bumps the CDN `width=` segment) |
| `components/chat.tsx` | `ChatShell`, message rendering (assistant text via `RichText`), tool dispatch, welcome screen (shopping-mode chips + a **"Reorder my usual"** chip when order history exists), composer, cart + account panels, store rehydration, **session switching/creation/deletion**, order capture. The chat transport builds the request body (cart/locale/profile) **at send time** via `prepareSendMessagesRequest`, so a "Try again" regenerate carries it too. In-progress tool calls render as a small team of **specialists** (`SPECIALIST` map → Shopper/Logistics) |
| `components/chat-sidebar.tsx` | The chat-history sidebar — off-canvas drawer below `lg`, static collapsible column from `lg` up. Sessions grouped Today/Yesterday/Previous 7 days/Older, **cross-chat search**, inline rename, two-step delete; the footer carries the account row + locale/theme switchers (they moved out of the header — six controls don't fit a 375px header) |
| `lib/chat/search.ts` | Cross-chat search over titles **and** message text, with a highlighted snippet for body matches. Parsed transcripts are cached per session and invalidated by `updatedAt`, so a warm search re-reads nothing. Reads localStorage → call it from an event handler, never during render |
| `components/sheet.tsx` | Shared shell for the cart + account panels: **bottom sheet on phones**, right-hand side panel from `sm` up. Both translate axes are pinned explicitly per state, or a closed sheet parks itself off-screen diagonally |
| `lib/chat/store.ts` + `chat/storage.ts` | Chat sessions. The store (`malee-chats`) holds only the *index* — id, title, timestamps, `activeId` — plus `save()`, which writes the transcript and bumps `updatedAt`, shedding the oldest transcripts if localStorage is full. Bodies live one key per session (`malee-chat:<id>`), so saving a turn re-serializes one transcript instead of all of them. Also `deriveTitle`, `firstUserText`, and the pure `groupSessions` date buckets |
| `components/cards.tsx` | Product / delivery / order / tracking cards + `AddToCart`, `SmartImage`. Detail card has a thumbnail **gallery**; the order card itemises from the tool input/order record and previews the 💌 gift message; tracking renders as an icon **stepper** with a pulsing current step + items. Plus the account cards: `AccountProfileCard` (welcome-back), `OrderHistoryCard` (status pill + Track / Buy again per order), `AddressBookCard` (Home/Office labels, "Deliver here"), `ReorderCard` (old vs today's price, unavailable items, "Add all to cart") |
| `components/account-drawer.tsx` | Kapruka **sign-in** (email the shopper types; demo address shown only as a hint) + saved-details editor + local order history with one-tap **Reorder** / Pay / Track |
| `components/rich-text.tsx` | Dependency-free inline Markdown-lite formatter (bold/italic/links) for Malee's chat messages — no Markdown library. Only http(s)/mailto links are linkified; a `[label](PRODUCT_ID)` from the model renders as just the label |
| `app/globals.css` | Tailwind v4 theme tokens (Dark default = deep violet charcoal; Light = Kapruka brand palette; Warm = green + saffron) + animations + per-locale Sinhala/Tamil font stacks (`html[data-locale=…]`) |
| `scripts/mcp-smoke.ts` | Live MCP integration test (`npm run mcp:test`) |

## Kapruka MCP — read before touching tools
- Endpoint `https://mcp.kapruka.com/mcp`, Streamable HTTP, **no auth**. Free tier ~60 req/min; `create_order` 30/hr.
- Every tool call nests args under a **`params`** object, and we force `response_format: "json"`. Results arrive as a JSON *string* in `result.content[0].text`; `callTool` returns `{ json, text }`.
- **Search quirk:** the catalog files most items under a generic `General` category, so a `category` filter frequently returns nothing. `searchProducts` searches keywords-first and **auto-retries without the category** when empty (`isEmptyResult`), **dedupes results by id** (`dedupeById` — the catalogue sometimes returns the same product twice, colliding on React's `key`), and **drops total-mismatch result sets** (`dropIrrelevant`). Kapruka's search is fuzzy: a rare/over-specific query (e.g. `"samba rice"`) returns unrelated popular items (chocolate hampers) — so when no result shares a meaningful whole word with the query, the tool returns empty + a note and the model retries simpler. It also **strips product `url`s** from search results (`stripResultUrls`) so a weak model can't paste deep product links in chat — the cards link out instead (getProduct keeps its url for the detail card). Prefer **simple product nouns for staples**, short descriptive phrases for distinctive gifts; the persona maps vernacular nouns (lunu→onions, miris→chillies…) to English before searching.
- **Curated display:** loosely-related results that survive the filters (pizzas for "miris") never reach the shopper directly — search results are **private to the model**, and only the ids it passes to `presentProducts` render as cards. Summaries come from a module-scoped stash filled by every search/getProduct (capped, per warm instance); stash misses fall back to `kapruka_get_product` (cached).
- **`create_order` is a REAL transaction** — it mints a guest order + click-to-pay link (no money moves until someone pays). Test only with explicit authorization: `npm run mcp:test -- --order`. The persona must show an order summary and get explicit confirmation before calling it.
- **Response caching:** read-only tools are cached in-memory with a per-tool TTL (`READ_TTL_MS` in `lib/mcp.ts` — categories/cities 30 min, customer details/addresses 10 min, `get_product` 5 min, `search_products` 2 min, `order_history` 1 min), so repeat calls skip the network and the rate limit (Kapruka explicitly asks clients to cache). `create_order`/`track_order` are absent from the map, so never cached. The cache is module-scoped (per warm server instance).

## Kapruka account — Phase 2 tools (Top-25 finalist private preview)
Three extra MCP tools expose a real customer's account. They are **not in `tools/list`** — call them by name. Requires `KAPRUKA_ACCESS_TOKEN` in the env; without it the tools return a friendly "not configured" note and the rest of the app is unaffected.

- `kapruka_customer_details` · `kapruka_order_history` · `kapruka_customer_addresses`, all taking `email` + `access_token` inside the usual `params` envelope.
- **The preview backend only serves `sandaru.perera@gmail.com`**; any other email returns `Error (email_not_allowed): …` — which arrives as a JSON-encoded *string*, not an object (hence the `typeof json === "string"` branch in `run()`).
- **`limit` is 1–10, not 1–20** as the published guide claims — 20 returns `Error (invalid_parameter)`. The Zod schema caps at 10 and `fetchHistory` clamps again.
- **Two security gates, both server-side** (Kapruka's stated top concern, and worth demoing):
  1. The token is read only in `lib/agent/tools.ts`, never appears in a tool result, and `redact()` strips it from error text — the MCP echoes rejected argument values back in validation errors, which would otherwise leak it into the transcript.
  2. `allowedEmails()` in the route rebuilds, per request, the set of addresses the **shopper** typed — the sign-in field plus `role === "user"` text parts only. Assistant text and tool results are excluded on purpose, so an email smuggled into a product description can't widen the lookup. `buildAccountTools({ allowedEmails })` closes over it, so the executor refuses before any network call. Verified: with the email present only in assistant text, the model *does* attempt the call and the guard refuses it.
- **The payloads are messy** and every field is normalized in `lib/account/normalize.ts` before it reaches the model or a card: keys with spaces (`"full name"`, `"unit price"`), phones ending in a stray `<BR`, addresses ending in `LT-HOUSE OR RESIDENCE-`, ALL-CAPS names, product names carrying `MessageID …jpg` / `CGRT[…]` / `#ADDONGC` / backticks, the `"NO PERSONAL MESSAGE"` sentinel, money as strings, dates as `"Mon Aug 03 07:18:12 EDT 2026"` or `"1 / MARCH / 2027"`, and a `recent delivery addresses` list that repeats the address book. `npm run mcp:test` asserts these stay scrubbed.
- **Reorder** (`reorderPastOrder`) is ours, not the MCP's: it re-prices a past order against the live catalogue (`get_product` per line, cached), flags price drift, and splits out-of-stock/discontinued items. Real history ids mostly still resolve — but not all (`msgbottle001` is gone), so the "unavailable" path is a real case, not a hypothetical.
- Order-history references (`VCOD…`) work directly with `kapruka_track_order`, which is what makes history → tracking one tap.

## AI provider & model
- Swap via env (`lib/agent/model.ts`): `AI_PROVIDER=google` (default) | `anthropic`; optional `AGENT_MODEL` to pin a model.
- Default **`gemini-3.1-flash-lite`** — the most generous Gemini free tier (15 RPM / 500 RPD; 2.5-flash is only 5 RPM / 20 RPD). Switch to Claude with `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (default `claude-sonnet-4-6`).
- **Anthropic prompt caching** (all inert on Gemini): the leading system message carries `cacheControl: ephemeral` (caches tools+system), and the last **two** user messages in the converted history carry breakpoints too — the older one re-reads the entry the previous turn wrote (whole history at ~0.1× price), the newer one writes the next turn's entry. This only works because history bytes are stable: volatile context (date, cart, profile, locale) rides as a **separate trailing user message** (`contextMessage`), never merged into the shopper's message or the system prompt. Keep `SYSTEM_PROMPT` byte-stable per deploy.
- Rate-limit/quota errors map to a friendly, **localized** "try again" message in the route's `onError` (en/si/ta, like the 429 texts); `stopWhen: stepCountIs(12)` caps model calls per turn (a grocery run needs search+present pairs per item).
- **Abuse guards (route):** per-IP sliding-window rate limit (12 req/min, in-memory per instance, localized 429 text) + a **global daily circuit breaker** (`DAILY_CHAT_CAP`, default 600/UTC day — protects a paid Anthropic balance; sits above Gemini's own 500/day so the free tier bites first) + the model only sees the last 30 messages (`ignoreIncompleteToolCalls` handles the clamped edge), text parts capped at 4 000 chars, cart context capped at 50 lines. A public demo on a free-tier key dies without this.

## Cart, profile & order history (client-owned, persisted)
- Three Zustand stores persist to localStorage (`malee-cart`, `malee-profile`, `malee-orders`). They set `skipHydration` so the first client render matches the SSR HTML; `ChatShell` calls each store's `persist.rehydrate()` once on mount (badges fill a tick after paint — no hydration mismatch).
- The cart is client-owned (`lib/cart/store.ts`); "Add to cart" fills it and the drawer manages quantities. Malee can fill it too: the `addToCart` tool executes server-side (authoritative name/price/image from the stash/`get_product`) and `useCaptureCartAdds` (`lib/cart/capture.ts`) bridges each result into the store — deduped by `addId` against a persisted `seenAdds` set, so reload/restore never re-adds what the shopper removed. Removal stays drawer-only (no tool; the persona says so honestly). The chat transport sends `cart`, the saved `profile`, and `locale` with **every request** (built at send time in `prepareSendMessagesRequest` — regenerates included); the route injects a compact cart summary + a saved-details block (+ today's Colombo date) into the latest user turn, so Malee knows what to order and can offer to reuse the shopper's details (she still confirms, and collects fresh details for a gift to someone else). Checkout builds `create_order` from those `product_id`s.
- The order-confirmation card (`OrderSummaryCard`) itemises from the **captured order record** (richest; survives reloads), falling back to the tool input's cart lines enriched from a mount-time cart snapshot — `create_order` returns totals only, no line items. The model also passes each item's `name` and `unitPrice` in the createOrder input (display-only — the tool's `execute` whitelist keeps them out of the MCP payload), so even a direct cart-less order reads properly, with prices, in the receipt and order history. It previews the 💌 gift message when present.
- **Order history + reorder:** `useCaptureOrders` (run in `ChatShell`, gated on hydration) watches the transcript and, when a `createOrder` tool part returns a pay link, records the order — items from the tool *input* (authoritative), enriched with name/price/image from the live cart — into `lib/orders/store.ts` (deduped by `order_ref` **before** side effects, against a persisted **`seen`** set that survives remove/"Clear history" — a transcript re-scan must never resurrect deleted orders), **removes the ordered items** from the cart (scoped to the order's own product ids — a direct cart-less order can't wipe items staged for a later purchase), and **seeds** the profile if it's empty (only from a self-purchase — never a gift to someone else). The account drawer lists past orders with one-tap **Reorder** (refills the cart, opens it) and Pay (while the 60-min link is live); the welcome screen surfaces a **"Reorder my usual"** chip for the latest order. A separate **Track an order** field takes the post-payment order number (from the confirmation email) and asks Malee to track it. The MCP has no "list orders" or order-edit tool, so history is browser-only and a placed order can't be modified — only tracked (the persona is told this).
- **Chat transcripts** also persist, so a refresh resumes the conversation. `ChatShell` rehydrates the five stores **first**, then loads the active transcript — the ordering matters, or capture would re-record (and re-clear the cart for) every restored order. It re-saves after each settled turn (not per token mid-stream), and only when a `dirty` ref says the shopper actually started that turn: merely *opening* an old chat must not bump its `updatedAt` and shuffle it to the top of the sidebar.

## Chat sessions (the sidebar)
- Many conversations, **one** cart / profile / order history / account — a shopper has one basket no matter how many threads they keep. Only the transcript is scoped to a session.
- **`useChat` is keyed by session id**, and the AI SDK recreates its internal `Chat` whenever that `id` changes (`shouldRecreateChat` in `@ai-sdk/react`), seeding from the `messages` option. That's the whole isolation story: `chat.id` and `chat.initial` move together in a single state update, so a late chunk from a stream we walked away from lands in the orphaned instance, which nothing renders and nothing saves. Switching also calls `stop()` and flushes the outgoing transcript first.
- A session is registered on its **first message**, never on "New chat" — an opened-and-abandoned chat leaves nothing in the list. The draft's uuid becomes the session id, so nothing has to change mid-send.
- **Titles are derived** from the shopper's opening line (`deriveTitle`, 48 chars) and renameable inline. Deliberately not LLM-generated: a title call per chat would spend the free-tier quota (15 RPM / 500 RPD) that the actual shopping needs.
- **Migration:** the pre-sessions `malee-chat` key is read once on first load after the upgrade, becomes chat #1 titled from its opening line, and is removed (`takeLegacyTranscript`).
- **Search** (`lib/chat/search.ts`) covers titles *and* what was said — a title only captures the opening line, but people search for "that Kandy cake". Body matches render a highlighted snippet. It runs in the input's change handler (it reads localStorage, so never during render) and parks results in state.
- **Sidebar collapse is persisted** (`sidebarPinned` in the store), so it survives reloads. The width transition is gated behind a *double-rAF* flag (`animateSidebar`), not plain `hydrated`: rehydration flips the sidebar shut a frame after first paint, and with the transition already live a restored "collapsed" preference would wipe closed on every load instead of simply being closed.
- Switching sessions re-runs the capture effects over the newly loaded transcript — safe **only** because they dedupe against persisted `seen`/`seenAdds` sets. Anything new that watches the transcript must dedupe the same way.

## Mobile-first
Most Kapruka shoppers are on a phone, so phone is the base case and `sm:`/`lg:` are the enhancements:
- `app/layout.tsx` exports `viewport` with `viewportFit: "cover"` (hands us `env(safe-area-inset-*)`, spent by the `.safe-bottom` utility under the composer and sheet footers) and `interactiveWidget: "resizes-content"` (the keyboard shrinks the viewport, so `h-dvh` keeps the composer docked instead of pushing the header off-screen). No `maximumScale`/`userScalable` — pinch-zoom stays available.
- **Inputs are 16px on mobile** (`text-base sm:text-sm`). Anything smaller makes iOS Safari zoom the viewport on focus and never zoom back out — this is a functional rule, not a style choice.
- Touch targets are ≥40px below `sm` (`min-h-10`/`h-10 sm:h-9`), including the product-card **Add to cart** / **Details** pills, which are the most-tapped controls in the app.
- Cart + account render through `Sheet` (bottom sheet on phones, side panel from `sm`); the sidebar is a drawer below `lg`. Scroll areas carry `overscroll-contain` so a flick inside a panel doesn't scroll the page behind it.
- **Signed in?** The Kapruka account is then the real history (`getOrderHistory`), and the drawer's local list re-titles to "Placed in this chat" — the two are never merged. The account also **fills blank** saved-details fields (`useCaptureAccount`), so checkout is pre-filled from Kapruka rather than from memory; anything the shopper typed themselves is left alone.

## Localization (i18n)
- Three locales — **English (default)**, **Sinhala (සිංහල)**, **Tamil (தமிழ்)**. No URL routing (`/si`, `/ta`): Malee is a single-screen client app, so locale is a **cookie** (`malee-locale`) read in the root layout and switched live on the client. Reading the cookie makes `/` dynamically rendered — an accepted trade-off for SSR-correct language (no flash, correct `<html lang>`).
- UI strings live in `lib/i18n/messages.ts` (`en` is the typed source of truth; `si`/`ta` must match its shape). Components read them via `useT()`; interpolated strings are small functions. Quick-action chips (shopping-mode/example/details/delivery/category/checkout) are localized too, since they post to Malee as the shopper's words.
- **Not translated:** live catalogue data (product names, categories, cities) and proper nouns (Malee, Kapruka, Avurudu, Ayubowan, "Rs") — the Kapruka catalogue is English.
- **Reply language:** the client sends `locale` each turn; `localeContext()` steers Malee to greet/reply in Sinhala/Tamil by default (English needs no steer). The shopper's actually-typed language always wins — see the persona "Voice" rules.
- Sinhala/Tamil glyphs use a system/Noto font stack (brand Latin font first) — no extra web fonts bundled.

## Dev workflow
```bash
npm install
cp .env.example .env.local        # add GOOGLE_GENERATIVE_AI_API_KEY (+ KAPRUKA_ACCESS_TOKEN for the account tools)
npm run dev                       # http://localhost:3210  (3210 avoids a local :3000 conflict)
npm run mcp:test                  # live MCP read-only chain + Phase 2 tools/normalizers ( -- --order to exercise create_order )
npm run typecheck && npm run lint
npm run build
```
Deploy: Vercel (`vercel --prod`); set `GOOGLE_GENERATIVE_AI_API_KEY` in the project's env vars. Full steps in `README.md`.

## Conventions
- **Commits are authored only by the user.**
- **Branching:** `dev` is the integration branch — cut feature branches from `dev` and PR back into `dev` (`gh pr create --base dev`). `dev → main` is the release merge; production deploys from `main`.
- **Git hooks (husky):** `pre-commit` runs `typecheck` + `lint` (fast, high-signal); `pre-push` runs the full `build` (mirrors the Vercel build, so it runs once per push, not per commit). They self-install via the `prepare` script on `npm install`. Bypass for WIP with `git commit --no-verify` / `git push --no-verify`.
- **Keep docs in step:** when a change adds/renames a module or alters documented behavior, architecture, or a convention, update `CLAUDE.md` in the **same commit** (and `README.md` for setup/deploy/env changes). Trigger-based, not a gate — most commits don't need it.
- `.env*` is gitignored (except `.env.example`); never commit secrets. `.claude/settings.local.json` is ignored too.
- **Add a tool:** define it in `lib/agent/tools.ts` (Zod schema + `execute` → `run("kapruka_…")`), then render its result in `components/chat.tsx` `ToolView`, add a card to `components/cards.tsx`, and give it a `tools.*` label + a `SPECIALIST` entry. A tool needing per-request context (like the shopper's identity) goes in `buildAccountTools()` rather than the static `kaprukaTools` object.
- **Never expose `KAPRUKA_ACCESS_TOKEN` to the client** — no `NEXT_PUBLIC_` prefix, never in a tool result, and keep it out of anything the model can echo.
- **Tweak the persona:** edit `SYSTEM_PROMPT` in `lib/agent/prompt.ts`.
- **Add a UI string:** add the key to `en` in `lib/i18n/messages.ts` (TS then forces `si`/`ta` to match), and read it with `useT()`. **Add a locale:** extend `LOCALES`/`LOCALE_META` in `lib/i18n/config.ts`, add the dictionary, and (optionally) a font stack in `app/globals.css`.

## Framework note
@AGENTS.md
