/**
 * Nudge / follow-up message drafting prompt.
 * Generates a brief, polite follow-up for Waiting-For items.
 */

export const SYSTEM = `Write a brief, polite follow-up message. 2-3 short sentences.
Professional but warm. No greeting line or sign-off — just the body.
Return JSON only: {"text": "..."}`;

export function buildUserMessage(title, who, sinceDays) {
  return `Draft a follow-up about "${title}" directed at ${who}. It has been ${sinceDays} days since this was last active.`;
}
