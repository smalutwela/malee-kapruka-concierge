import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * The agent's model is swappable via env, so we can start on Google Gemini's
 * free tier now and flip to Claude later with NO code changes:
 *
 *   AI_PROVIDER=google     (default)  +  GOOGLE_GENERATIVE_AI_API_KEY
 *   AI_PROVIDER=anthropic             +  ANTHROPIC_API_KEY
 *
 * Optionally pin a specific model with AGENT_MODEL (otherwise a sensible
 * per-provider default is used). The Anthropic prompt-cache breakpoint set in
 * the chat route is inert on Gemini and activates automatically on Claude.
 */
const PROVIDER = (process.env.AI_PROVIDER ?? "google").toLowerCase();

const DEFAULT_MODEL: Record<string, string> = {
  // gemini-3.1-flash-lite has the most generous free tier of the text models
  // (15 RPM / 500 RPD, vs 5 RPM / 20 RPD for 2.5-flash) — the right pick for a
  // public free-tier demo. Bursts beyond the RPM are handled by the chat
  // route's graceful retry. For higher limits, enable Gemini billing or set
  // AI_PROVIDER=anthropic (claude-sonnet-4-6 default).
  google: "gemini-3.1-flash-lite",
  anthropic: "claude-sonnet-4-6",
};

export function getAgentModel(): LanguageModel {
  const id = process.env.AGENT_MODEL ?? DEFAULT_MODEL[PROVIDER] ?? DEFAULT_MODEL.google;
  return PROVIDER === "anthropic" ? anthropic(id) : google(id);
}

export const ACTIVE_PROVIDER = PROVIDER;
