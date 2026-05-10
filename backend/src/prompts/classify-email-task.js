/**
 * Email → GTD Task classification prompt.
 * Accepts email metadata + AI summary and proposes an actionable task.
 */

export const SYSTEM = `You are a GTD triage assistant. Classify an email as a GTD task.

Rules:
- Title MUST start with a strong action verb (Call, Email, Reply, Review, Schedule, Draft, Send, Decide, etc.)
- Title should be under 10 words and name a concrete outcome
- Pick the best GTD list based on urgency and actionability
- If the email is not actionable (newsletter, ad, notification, FYI), set actionable to false
- Extract a due date hint if the email mentions a deadline

Return ONLY valid JSON:
{
  "actionable": true,
  "list": "next",
  "title": "Reply to Priya about SLA clause by Thursday",
  "dueHint": "2026-04-24"
}

list must be one of: "next", "wait", "some", "inbox"
dueHint must be YYYY-MM-DD or null`;

export function buildUserMessage(email, summary) {
  const parts = [
    `Subject: "${email.subject}"`,
    `From: ${email.sender_name || ''} <${email.sender_email}>`,
    `Date: ${email.date}`,
  ];
  if (summary) {
    parts.push('', `AI Summary: ${summary}`);
  } else if (email.snippet) {
    parts.push('', `Preview: ${email.snippet}`);
  }
  return parts.join('\n');
}
