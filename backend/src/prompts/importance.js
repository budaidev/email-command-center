/**
 * Importance rubric (card #239). One email per call, three yes/no criteria, each
 * with a verbatim quote as evidence. The live text is the Langfuse prompt
 * IMPORTANCE_PROMPT_NAME (label "production"); LOCAL_SYSTEM is the fallback used
 * when Langfuse is unreachable, and the text the prompt was first created from.
 */

export const IMPORTANCE_PROMPT_NAME = 'ecc-importance';

export const CRITERIA = ['reply_or_decision', 'mandatory_appointment', 'payment_due'];

export const LOCAL_SYSTEM = `You decide whether one email needs its recipient's personal attention. The recipient is the owner of the mailbox.

Answer three yes/no questions about the email.

1. reply_or_decision: does the email expect the owner personally to reply, decide, approve, choose, or provide information or a document? Yes when a person, or a service handling the owner's own case, is waiting for the owner. Mass mailings that only invite a response ("reply to learn more", "take our survey", "rate your purchase") are No.

2. mandatory_appointment: does the email set, propose, change or cancel an appointment the owner must attend or confirm (doctor, official office, school, work meeting, service visit, delivery slot that needs someone at home, exam, hearing)? Webinars, events, sales invitations and optional programmes are No.

3. payment_due: does the owner have to pay something (invoice, bill, fee, fine, tax, overdue notice, failed payment that needs action)? Receipts for payments already made, automatic debits that need no action, price offers and promotions are No.

Never important, whatever the wording: spam, advertising, newsletters, promotional offers, and simple announcements or notifications that require nothing from the owner.

For every Yes, "evidence" is an exact quote, copied character for character from the subject or body, at most 200 characters, that shows why. For every No, "evidence" is "".

Also return:
- "kind": one of personal, work, transactional, notification, newsletter, advertising, spam
- "why": one short sentence in Hungarian explaining the verdict
- "action_type": one of reply, review, decide, schedule, pickup, send, delegate, task, none
- "suggested_task": a short Hungarian task title starting with a verb when any answer is Yes, otherwise null

Return JSON only, in exactly this shape:
{"reply_or_decision": {"answer": false, "evidence": ""}, "mandatory_appointment": {"answer": false, "evidence": ""}, "payment_due": {"answer": false, "evidence": ""}, "kind": "notification", "why": "...", "action_type": "none", "suggested_task": null}`;

const BODY_CHARS = 4000;

/** The user message: one email. Gmail labels are left out on purpose: Gmail's own
 *  "Important" flag is a baseline the evaluation is compared against. */
export function buildEmailMessage(e) {
  const parts = [];
  parts.push(`From: ${e.sender_name || ''} <${e.sender_email}>`);
  if (e.recipients) {
    try {
      const recips = typeof e.recipients === 'string' ? JSON.parse(e.recipients) : e.recipients;
      const to = Array.isArray(recips) ? recips.map(r => r.email || r.name || '').filter(Boolean).join(', ') : '';
      if (to) parts.push(`To: ${to}`);
    } catch {}
  }
  parts.push(`Subject: ${e.subject || '(no subject)'}`);
  parts.push(`Date: ${e.date}`);
  const body = (e.body_text && e.body_text.trim()) ? e.body_text : (e.snippet || '');
  parts.push('');
  parts.push(body.slice(0, BODY_CHARS));
  return parts.join('\n');
}
