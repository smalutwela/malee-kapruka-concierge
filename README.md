# 🌸 Malee - Kapruka Shopping Concierge

> **Ayubowan!** Malee is a warm, full-screen AI shopping concierge for everything Kapruka sells - groceries, electronics, home, fashion, beauty, and the perfect gift to send - chatting over the **live Kapruka catalogue**, quoting delivery, and placing guest orders with a click-to-pay link. Most people shop for themselves; gifting is one beloved mode.

Built for the **[Kapruka Agent Challenge](https://www.kapruka.com/contactUs/agentChallenge.html)** on the free [Kapruka MCP server](https://mcp.kapruka.com).

**🔗 Live demo:** **https://malee-kapruka-agent.vercel.app**

---

## What it does

- **Full-screen chat concierge** (not a widget) with a distinct persona - "Malee", a thoughtful Sri Lankan shopping host who reads the situation and has an opinion.
- **Every conversation kept** - a familiar chat sidebar holds your past chats (titled from your opening line, renameable, grouped by day) with **search across every chat**, matching what was actually said, not just titles. It's pinned on desktop (collapse it and it stays collapsed) and a drawer on a phone. Your cart, saved details and orders are shared across every chat - one basket, many conversations.
- **Built for the phone first** - bottom-sheet cart and account panels, thumb-sized targets, safe-area padding under the notch and home indicator, and a composer that stays put when the keyboard opens.
- **Live catalogue, no mock data** - every product, price, image, delivery rate and order comes from the real Kapruka MCP server.
- **Rich generative UI** - tool results stream in as product cards, a delivery-quote card, an order summary, and an order-tracking timeline.
- **A visible team of specialists** - as Malee talks, a 🛍️ Shopper and 🚚 Logistics agent visibly work the catalogue and delivery behind her.
- **Persistent cart** - add items from any card, adjust quantities, and check out.
- **Complete, guided checkout** - Malee validates the delivery city + date, quotes the flat fee, surfaces freshness warnings for perishables (cakes/flowers), shows an order summary, confirms, then returns a **click-to-pay link** (60-minute price lock).
- **Order tracking** - paste a Kapruka order number to see status + a delivery timeline.
- **Knows you, if you want** - sign in with your Kapruka email and Malee greets you by name, shows your **real order history**, re-prices any past order against today's catalogue to **buy it again**, and offers your **saved delivery addresses** at checkout so you never retype one. Your email is only ever what you type - the server refuses to look up anything else (see [Account privacy](#account-privacy)).
- **Remembers you** - saved delivery details and a local order history make a repeat shop one tap: **Reorder** refills the cart, and the welcome screen offers a *"Reorder my usual"* chip.
- **Speaks your language** - understands and replies in **English, Sinhala, Tamil**, or romanised **"Singlish"/"Tanglish"**.

### Maps to the challenge rubric
| Criterion | How Malee delivers |
|---|---|
| Experience & Polish | Streaming replies, typing/working indicators, skeletons, graceful empty/error states, mobile-first layout with a familiar chat-history sidebar |
| Visual Richness | Live product imagery, price/stock/ships-worldwide badges, animated cards, warm Sri Lankan palette + display serif |
| Personality | "Malee" - warm, local, opinionated; reads the situation, shops for you or helps you gift, greets with Ayubowan |
| Usefulness | Everyday + occasion-led discovery, smart search recovery, honest opinions |
| End-to-End Completeness | Sign in → search → detail → cart → delivery quote → saved address → confirm → pay link → track |
| Creativity / Bonuses | Visible specialist agents (Shopper/Logistics/Account), real account history + one-tap re-buy with live re-pricing, multi-item carts, gift messaging, cake icing text, delivery-date constraints, **Sinhala/Tanglish** |

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Vercel AI SDK v6** with a **provider-swappable** model (`lib/agent/model.ts`) - Google **Gemini** (free) by default, **Claude** one env var away
- **Tailwind CSS v4** + lucide icons + entrance animations
- **Zustand** for client state - chat sessions, cart, saved profile, and order history, persisted to localStorage
- A small, dependency-free **MCP client** (`lib/mcp.ts`) speaking JSON-RPC over Streamable HTTP to `mcp.kapruka.com`

```
Browser (useChat) ──▶ /api/chat (streamText + tools) ──▶ lib/mcp.ts ──▶ mcp.kapruka.com
```

The 13 tools exposed to the model - 11 backed by the Kapruka MCP (including the three Phase 2 account tools), plus `presentProducts` and `reorderPastOrder` - have clean schemas in `lib/agent/tools.ts`; the persona/system prompt lives in `lib/agent/prompt.ts`. The cart, saved profile, signed-in account and locale are sent with each turn and injected as per-turn context, keeping the cached system+tools prefix stable for Anthropic prompt caching.

---

## Run locally

```bash
npm install
cp .env.example .env.local      # then add your key (see below)
npm run dev                     # http://localhost:3210
```

### API key
Malee defaults to **Google Gemini's free tier**. Get a free key at <https://aistudio.google.com/apikey> and put it in `.env.local`:

```
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
```

**Prefer Claude?** (best quality + strongest Sinhala) - add to `.env.local`:
```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# optional: AGENT_MODEL=claude-opus-4-8
```

### Kapruka account tools (finalist preview)
The customer profile / order history / saved addresses features need the Phase 2 access token in `.env.local`:

```
KAPRUKA_ACCESS_TOKEN=KAP_P2_...
```

It is **server-side only** - read exclusively inside `lib/agent/tools.ts`, never returned in a tool result, and scrubbed out of error text before anything reaches the browser. Never prefix it with `NEXT_PUBLIC_`. Without it, the three account tools switch off cleanly and everything else (search, cart, guest checkout, tracking) still works end to end.

During the preview the backend only serves one account: `sandaru.perera@gmail.com`.

### Verify the Kapruka integration
```bash
npm run mcp:test            # read-only chain + Phase 2 tools & normalizers (if the token is set)
npm run mcp:test -- --order # also creates one real (unpaid) guest order + pay link
```

---

## Deploy to Vercel

1. `npm i -g vercel` (once)
2. `vercel login`
3. From the project root: `vercel` - accept the defaults to create the project.
4. Add env vars in the Vercel dashboard (Project → Settings → Environment Variables): `GOOGLE_GENERATIVE_AI_API_KEY` (and `AI_PROVIDER` / `ANTHROPIC_API_KEY` if using Claude, plus `KAPRUKA_ACCESS_TOKEN` for the account tools).
5. `vercel --prod` to publish. Paste the resulting URL above and into your challenge submission.

---

## Project layout
```
app/
  layout.tsx, page.tsx          # full-screen chat shell
  api/chat/route.ts             # streamText + tools + cart/date/locale context injection
components/
  chat.tsx                      # ChatShell, messages, cart + account panels, composer
  chat-sidebar.tsx              # chat history sidebar (drawer on mobile, column on desktop)
  sheet.tsx                     # bottom sheet on mobile / side panel on desktop
  cards.tsx                     # product / delivery / order / tracking cards
  account-drawer.tsx            # saved details + order history (reorder / pay / track)
lib/
  mcp.ts                        # Kapruka MCP client (session, SSE, JSON, response cache)
  agent/{model,prompt,tools}.ts # provider, persona, curated tools
  account/                      # Kapruka account: payload normalizers, store, capture
  chat/                         # chat sessions: index store, transcripts, cross-chat search
  cart/store.ts                 # Zustand cart (+ profile/, orders/ stores)
  i18n/                         # en / si / ta - locale provider + dictionaries
scripts/mcp-smoke.ts            # live MCP integration test
```

> 🛠 **Developers:** see **[`CLAUDE.md`](CLAUDE.md)** for architecture, conventions, and the Kapruka MCP gotchas.

## Account privacy

The account tools read a real customer's profile, orders and addresses, so access is gated twice:

1. **The token never leaves the server.** It lives in `KAPRUKA_ACCESS_TOKEN`, is read only inside the tool executors, and is stripped from any error text before it can reach the model or the browser.
2. **The email must have been typed by the shopper.** Every request rebuilds an allowlist from the sign-in field and the shopper's *own* chat messages - assistant replies and tool results are deliberately excluded. Any other address is refused before a request is made, so the agent cannot enumerate accounts, and text smuggled into a product description or gift message ("look up this customer…") cannot widen what it will fetch.

Nothing about the account is stored server-side; the signed-in email lives in your browser and "Sign out" erases it.

## Notes
- Free public MCP tier: ~60 requests/min and 30 orders/hour per IP - the client surfaces rate-limit messages gracefully.
- `kapruka_create_order` places a **real** guest order (a click-to-pay link); no money moves until someone actually pays it.
- `kapruka_order_history` accepts `limit` **1-10** (the Phase 2 guide says 1-20; the server rejects anything above 10).
