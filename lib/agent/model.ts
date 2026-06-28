import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { createFallback } from "ai-fallback";
import type { LanguageModel } from "ai";

/**
 * Model selection: Claude primary, free-Gemini fallback.
 *
 * By default the agent runs on Claude (claude-sonnet-4-6) and transparently
 * falls back to Gemini's free tier on ANY Claude error — billing cap / credit
 * balance exhausted, 429 rate limit, model unavailable, or a network blip.
 *
 * The hard spend ceiling is enforced at Anthropic (prepaid credits + a
 * workspace spend limit), NOT here — this layer just degrades gracefully when
 * that ceiling (or any other error) is hit. The Anthropic prompt-cache
 * breakpoints set in the chat route stay active on Claude and are inert on the
 * Gemini fallback.
 *
 * Env escape hatches (AI_PROVIDER):
 *   unset       → Claude primary + Gemini fallback (default) when ANTHROPIC_API_KEY
 *                 is set, else Gemini only (a contributor without a Claude key
 *                 still works out of the box)
 *   "anthropic" → Claude only, no fallback (isolate Claude, e.g. to confirm billing)
 *   "google"    → Gemini only, no Claude spend (kill switch)
 * AGENT_MODEL pins the primary model id (default claude-sonnet-4-6 — or the
 * Gemini model when AI_PROVIDER=google).
 */
const CLAUDE_MODEL = "claude-sonnet-4-6";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

const FORCE = process.env.AI_PROVIDER?.toLowerCase();
const HAS_ANTHROPIC = Boolean(process.env.ANTHROPIC_API_KEY);

export function getAgentModel(): LanguageModel {
  // Gemini only — explicit kill switch, or no Anthropic key configured.
  if (FORCE === "google" || (!FORCE && !HAS_ANTHROPIC)) {
    return google(process.env.AGENT_MODEL ?? GEMINI_MODEL);
  }
  // Claude only — no fallback (isolate Claude, e.g. to confirm credits work).
  if (FORCE === "anthropic") {
    return anthropic(process.env.AGENT_MODEL ?? CLAUDE_MODEL);
  }
  // Default: Claude primary, Gemini fallback on ANY Claude error.
  return createFallback({
    models: [anthropic(process.env.AGENT_MODEL ?? CLAUDE_MODEL), google(GEMINI_MODEL)],
    // Fall back on ANY Claude error — the package's default retry list misses
    // the credit-balance 400, which is exactly the budget case we care about.
    shouldRetryThisError: () => true,
    // Don't replay a half-streamed answer on Gemini (would show duplicate text).
    // Billing / rate-limit / unavailable all error BEFORE streaming, so they
    // still swap silently; a rare mid-stream failure falls through to the
    // route's friendly retry message instead.
    retryAfterOutput: false,
    onError: (error, modelId) =>
      console.warn(
        `[model] "${modelId}" failed — falling back to Gemini:`,
        error instanceof Error ? error.message : error,
      ),
  });
}

export const ACTIVE_PROVIDER = FORCE ?? (HAS_ANTHROPIC ? "anthropic+google-fallback" : "google");
