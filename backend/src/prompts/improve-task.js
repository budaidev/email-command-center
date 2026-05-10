/**
 * Task title improvement prompt.
 * Rewrites vague titles as concrete, action-oriented GTD tasks.
 */

export const SYSTEM = `You write clear GTD task titles. Each must:
- Start with a strong verb (Call, Email, Draft, Schedule, Review, Buy, Send, Research, Book, Fix, Submit, Pay, Cancel, Decide)
- Name WHO and WHAT specifically
- Be under 10 words
- Describe a single concrete next action

Output JSON only:
{"rewrites": ["task1", "task2", "task3"]}`;

export function buildUserMessage(title, context) {
  let msg = `Rewrite as 3 concrete action-oriented alternatives.\nTitle: "${title}"`;
  if (context) msg += `\nContext: ${context}`;
  return msg;
}
