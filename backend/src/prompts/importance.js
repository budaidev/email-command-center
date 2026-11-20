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

1. reply_or_decision: does the email expect the owner personally to reply, decide, approve, choose, read and act on something, or provide information or a document? Yes when:
   - a real person writes to the owner personally (not a mass mailing): a recruiter or hiring manager about a role, an expert network with a request, the owner's accountant, a teacher, a colleague, a client or a service provider handling the owner's own case. A personal message that continues a conversation (sends the requested material, proposes next steps, follows up) is Yes even without an explicit question; only a pure "thanks" that closes the thread is No.
   - a bank, insurer, utility, authority or similar provider says a new document, letter, invoice or contract notice is waiting in the owner's account or portal: the owner has to open it.
   Mass mailings that only invite a response ("reply to learn more", "take our survey", "rate your purchase"), job alerts, and digests that only say someone messaged the owner on another platform (e.g. LinkedIn) are No.

2. mandatory_appointment: does the email set, propose, change or cancel an appointment the owner must attend or confirm (doctor, official office, school, work meeting, job interview, service visit, delivery slot that needs someone at home, exam, hearing)? Also Yes when a parcel or order is waiting for the owner at a pickup point, locker or shop and must be collected, usually by a deadline. Webinars, events, sales invitations, optional programmes and meeting-assistant reminders or summaries (Fireflies, Otter, etc.) are No.

3. payment_due: does the owner have to pay something (invoice, bill, fee, fine, tax, overdue notice, failed card charge or payment that needs action)? Receipts for payments already made, automatic debits that need no action, price offers and promotions are No.

Forwarded emails: when a family member or colleague forwards a notice to the owner (a bill, a fee deadline, an appointment), judge the forwarded notice as if it were addressed to the owner.

Never important, whatever the wording: spam, advertising, newsletters, promotional offers, and simple announcements or notifications that require nothing from the owner. Notifications from code hosting, issue trackers and project mailing lists (GitHub, Jira, Apache lists) are never important: at most "want_to_know".

For every Yes, "evidence" is an exact quote, copied character for character from the subject or body, at most 200 characters, that shows why. For every No, "evidence" is "".

Also return:
- "want_to_know": true when all three answers are No but the owner would still want to know about it: a receipt or confirmation of the owner's own purchase or payment, a change to the owner's billing, account or subscription, a security alert about the owner's accounts or devices, a message from the children's school or parent list, a summary of a meeting the owner attended, an update in a project or thread the owner takes part in (votes, reviews, CI failures on their pull request). False when any answer is Yes, and for advertising, newsletters and other mass mailings.
- "due": when any answer is Yes, the deadline, appointment date or pickup deadline stated in the email as "YYYY-MM-DD" (take the year from the email's Date when it is not written); otherwise null. Never invent a date the email does not state.
- "kind": one of personal, work, transactional, notification, newsletter, advertising, spam
- "why": one short sentence in Hungarian explaining the verdict
- "action_type": one of reply, review, decide, schedule, pickup, send, delegate, task, none
- "suggested_task": a short Hungarian task title starting with a verb when any answer is Yes, otherwise null

Return JSON only, in exactly this shape:
{"reply_or_decision": {"answer": false, "evidence": ""}, "mandatory_appointment": {"answer": false, "evidence": ""}, "payment_due": {"answer": false, "evidence": ""}, "want_to_know": false, "due": null, "kind": "notification", "why": "...", "action_type": "none", "suggested_task": null}`;

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
