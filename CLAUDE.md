# CLAUDE.md — Malee developer guide

**Malee** is a full-screen AI gift-concierge web app for the Kapruka Agent Challenge: a chat shopping experience over the **live Kapruka MCP server**, with rich product cards, a cart, and guided guest checkout (real click-to-pay links). This file orients developers — and AI sessions — on the architecture, conventions, and the non-obvious bits. User-facing setup/deploy lives in `README.md`.

## Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **Vercel AI SDK v6** (`ai`) with a provider-swappable model — `@ai-sdk/google` (default) or `@ai-sdk/anthropic`
- **Tailwind CSS v4** (CSS `@theme` tokens, no `tailwind.config`), `lucide-react`, **Zustand**
- A small, dependency-free **MCP client** (`lib/mcp.ts`) — JSON-RPC over Streamable HTTP

## Architecture / data flow
```
Browser  (components/chat.tsx, useChat)
  │  POST { messages, cart }
  ▼
app/api/chat/route.ts   streamText(model, tools) · injects date+cart context · graceful onError
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
| `lib/agent/prompt.ts` | `SYSTEM_PROMPT` (Malee persona) + `colomboContext()` (per-turn date) |
| `lib/agent/tools.ts` | 7 curated tools (clean Zod schemas → MCP `params` envelope) |
| `lib/mcp.ts` | MCP client: session lifecycle, SSE parse, JSON unwrap, re-init, rate-limit signalling |
| `lib/cart/store.ts` | Zustand cart (client-side source of truth) |
| `lib/types.ts` | Types mirroring Kapruka JSON shapes |
| `lib/utils.ts` | `cn`, `formatPrice`, `resizeImage` (bumps the CDN `width=` segment) |
| `components/chat.tsx` | `ChatShell`, message rendering, tool dispatch, welcome screen, composer, cart drawer |
| `components/cards.tsx` | Product / delivery / order / tracking cards + `AddToGift`, `SmartImage` |
| `app/globals.css` | Tailwind v4 theme tokens (Light/Dark/Warm; Light default = Kapruka brand palette) + animations |
| `scripts/mcp-smoke.ts` | Live MCP integration test (`npm run mcp:test`) |

## Kapruka MCP — read before touching tools
- Endpoint `https://mcp.kapruka.com/mcp`, Streamable HTTP, **no auth**. Free tier ~60 req/min; `create_order` 30/hr.
- Every tool call nests args under a **`params`** object, and we force `response_format: "json"`. Results arrive as a JSON *string* in `result.content[0].text`; `callTool` returns `{ json, text }`.
- **Search quirk:** the catalog files most items under a generic `General` category, so a `category` filter frequently returns nothing. `searchProducts` searches keywords-first and **auto-retries without the category** when empty (`isEmptyResult`). Prefer specific, descriptive queries.
- **`create_order` is a REAL transaction** — it mints a guest order + click-to-pay link (no money moves until someone pays). Test only with explicit authorization: `npm run mcp:test -- --order`. The persona must show an order summary and get explicit confirmation before calling it.

## AI provider & model
- Swap via env (`lib/agent/model.ts`): `AI_PROVIDER=google` (default) | `anthropic`; optional `AGENT_MODEL` to pin a model.
- Default **`gemini-3.1-flash-lite`** — the most generous Gemini free tier (15 RPM / 500 RPD; 2.5-flash is only 5 RPM / 20 RPD). Switch to Claude with `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (default `claude-sonnet-4-6`).
- **Anthropic prompt caching:** the leading system message carries `cacheControl: ephemeral` (inert on Gemini). Keep `SYSTEM_PROMPT` byte-stable — volatile context (date, cart) is injected into the **last user message**, never the system prompt, so the cached `tools`+`system` prefix stays valid.
- Rate-limit/quota errors map to a friendly "try again" message in the route's `onError`; `stopWhen: stepCountIs(8)` caps model calls per turn.

## Cart & context
- The cart is client-owned (`lib/cart/store.ts`); "Add to gift" fills it and the drawer manages quantities.
- Each turn the client sends `cart` in the request body; the route injects a compact cart summary (+ today's Colombo date) into the latest user turn, so Malee always knows what to order. Checkout builds `create_order` from those `product_id`s.

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
- **Commits are authored only by the user** — do not add a `Co-Authored-By: Claude` trailer.
- `.env*` is gitignored (except `.env.example`); never commit secrets. `.claude/settings.local.json` is ignored too.
- **Add a tool:** define it in `lib/agent/tools.ts` (Zod schema + `execute` → `run("kapruka_…")`), then render its result in `components/chat.tsx` `ToolView` and add a card to `components/cards.tsx`.
- **Tweak the persona:** edit `SYSTEM_PROMPT` in `lib/agent/prompt.ts`.

## Framework note
@AGENTS.md
