# 🌸 Malee — Kapruka Gift Concierge

> **Ayubowan!** Malee is a warm, full-screen AI shopping concierge that helps you find and send the perfect gift anywhere in Sri Lanka — flowers, cakes, chocolates and more — chatting over the **live Kapruka catalogue**, quoting delivery, and placing guest orders with a click-to-pay link.

Built for the **[Kapruka Agent Challenge](https://www.kapruka.com/contactUs/agentChallenge.html)** on the free [Kapruka MCP server](https://mcp.kapruka.com).

**🔗 Live demo:** _deploying — URL coming_

---

## What it does

- **Full-screen chat concierge** (not a widget) with a distinct persona — "Malee", a thoughtful Sri Lankan gifting host.
- **Live catalogue, no mock data** — every product, price, image, delivery rate and order comes from the real Kapruka MCP server.
- **Rich generative UI** — tool results stream in as product cards, a delivery-quote card, an order summary, and an order-tracking timeline.
- **Persistent gift cart** — add items from any card, adjust quantities, and check out.
- **Complete, guided checkout** — Malee validates the delivery city + date, quotes the flat fee, surfaces freshness warnings for perishables (cakes/flowers), shows an order summary, confirms, then returns a **click-to-pay link** (60-minute price lock).
- **Order tracking** — paste a Kapruka order number to see status + a delivery timeline.
- **Speaks your language** — understands and replies in **English, Sinhala, or Tanglish**.

### Maps to the challenge rubric
| Criterion | How Malee delivers |
|---|---|
| Experience & Polish | Streaming replies, typing/working indicators, skeletons, graceful empty/error states, mobile-friendly |
| Visual Richness | Live product imagery, price/stock/ships-worldwide badges, animated cards, warm Sri Lankan palette + display serif |
| Personality | "Malee" — warm, local, gifting-savvy; greets with Ayubowan, gentle tasteful upsell |
| Usefulness | Occasion-led discovery, smart search recovery, honest guidance |
| End-to-End Completeness | Search → detail → cart → delivery quote → confirm → pay link → track |
| Creativity / Bonuses | Multi-item carts, gift messaging, cake icing text, delivery-date constraints, **Sinhala/Tanglish** |

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Vercel AI SDK v6** with a **provider-swappable** model (`lib/agent/model.ts`) — Google **Gemini** (free) by default, **Claude** one env var away
- **Tailwind CSS v4** + lucide icons + entrance animations
- **Zustand** for the cart
- A small, dependency-free **MCP client** (`lib/mcp.ts`) speaking JSON-RPC over Streamable HTTP to `mcp.kapruka.com`

```
Browser (useChat) ──▶ /api/chat (streamText + tools) ──▶ lib/mcp.ts ──▶ mcp.kapruka.com
```

The 7 Kapruka tools are exposed to the model with clean schemas in `lib/agent/tools.ts`; the persona/system prompt lives in `lib/agent/prompt.ts`. The cart is sent with each turn and injected as per-turn context, keeping the cached system+tools prefix stable for Anthropic prompt caching.

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

**Prefer Claude?** (best quality + strongest Sinhala) — add to `.env.local`:
```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# optional: AGENT_MODEL=claude-opus-4-8
```

### Verify the Kapruka integration
```bash
npm run mcp:test            # read-only chain: categories, search, product, delivery
npm run mcp:test -- --order # also creates one real (unpaid) guest order + pay link
```

---

## Deploy to Vercel

1. `npm i -g vercel` (once)
2. `vercel login`
3. From the project root: `vercel` — accept the defaults to create the project.
4. Add env vars in the Vercel dashboard (Project → Settings → Environment Variables): `GOOGLE_GENERATIVE_AI_API_KEY` (and `AI_PROVIDER` / `ANTHROPIC_API_KEY` if using Claude).
5. `vercel --prod` to publish. Paste the resulting URL above and into your challenge submission.

---

## Project layout
```
app/
  layout.tsx, page.tsx          # full-screen chat shell
  api/chat/route.ts             # streamText + tools + cart/date context injection
components/
  chat.tsx                      # ChatShell, messages, cart drawer, composer
  cards.tsx                     # product / delivery / order / tracking cards
lib/
  mcp.ts                        # Kapruka MCP client (session, SSE, JSON)
  agent/{model,prompt,tools}.ts # provider, persona, curated tools
  cart/store.ts                 # Zustand cart
scripts/mcp-smoke.ts            # live MCP integration test
```

## Notes
- Free public MCP tier: ~60 requests/min and 30 orders/hour per IP — the client surfaces rate-limit messages gracefully.
- `kapruka_create_order` places a **real** guest order (a click-to-pay link); no money moves until someone actually pays it.
