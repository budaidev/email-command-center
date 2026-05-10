/**
 * Email triage prompt — scores every email on how much user attention is needed.
 * Supports configurable instructions, learned preferences, and few-shot feedback.
 */

export const SYSTEM = `You are an email triage assistant. Score each email on how much the user's personal attention and action is required.

Your score will be COMBINED with static rules (0-50 from rules + 0-50 from you = 0-100 final).
Score each email 0-50 based on content analysis only.

SCORING GUIDE (0-50):
- 0-10: No action needed. Newsletters, automated notifications, receipts, marketing, social media alerts, build/CI notifications, auto-replies.
- 11-25: Low priority FYI. Status updates, confirmations, CC'd threads where the user is not directly addressed.
- 26-40: Medium priority. Non-urgent requests, planning discussions, emails that may need eventual response.
- 41-50: High priority, needs prompt action. Direct questions awaiting reply, deadlines mentioned, delivery pickups, document review requests, meeting proposals, approval requests.

ACTION TYPES (pick the most specific one):
- reply: user needs to write back to someone
- review: user needs to read/approve a document, PR, or proposal
- decide: user needs to make a choice or give approval
- schedule: user needs to set up or confirm a meeting/appointment
- pickup: user needs to physically collect something
- send: user needs to provide information or deliver something
- delegate: user should assign this to someone else
- task: general to-do that doesn't fit the above
- none: no action needed

For each email return: score (0-100), action_type, reason (1 short sentence), and suggested_task (GTD-style title starting with action verb, or null if score < 50).

Return ONLY valid JSON:
{"results": [{"email_id": "...", "score": 80, "action_type": "reply", "reason": "...", "suggested_task": "..."}]}`;

export function buildUserMessage(emails, instructions, learnedProfile, feedbackExamples) {
  const parts = [];

  parts.push('USER INSTRUCTIONS:');
  parts.push(instructions || 'Flag emails that need a reply, decision, or concrete action.');
  parts.push('');

  if (learnedProfile) {
    parts.push('LEARNED PREFERENCES (from past feedback):');
    parts.push(learnedProfile);
    parts.push('');
  }

  if (feedbackExamples && feedbackExamples.length > 0) {
    parts.push(`PAST DECISIONS (${feedbackExamples.length} recent — learn from these):`);
    for (const ex of feedbackExamples) {
      const label = ex.decision === 'create_task' ? 'CREATED TASK' : ex.decision.toUpperCase();
      parts.push(
        `- From "${ex.sender_email}", subject "${ex.subject}"` +
        (ex.category_name ? ` [${ex.category_name}]` : '') +
        ` → AI scored ${ex.triage_score ?? '?'}/${ex.triage_action ?? '?'}, user ${label}` +
        (ex.reason ? ` (${ex.reason})` : '')
      );
    }
    parts.push('');
  }

  parts.push(`Triage these ${emails.length} emails. Return JSON: {"results": [...]}`);
  parts.push('');

  for (const e of emails) {
    parts.push(`[email:${e.id}]`);
    parts.push(`From: ${e.sender_name || ''} <${e.sender_email}>`);

    // Parse recipients if available
    if (e.recipients) {
      try {
        const recips = typeof e.recipients === 'string' ? JSON.parse(e.recipients) : e.recipients;
        if (Array.isArray(recips) && recips.length > 0) {
          const toList = recips.map(r => r.email || r.name || '').filter(Boolean).join(', ');
          if (toList) parts.push(`To: ${toList}`);
        }
      } catch {}
    }

    parts.push(`Subject: ${e.subject || '(no subject)'}`);
    parts.push(`Date: ${e.date}`);
    if (e.category_name) parts.push(`Category: ${e.category_name}`);

    // Parse labels if available
    if (e.labels) {
      try {
        const labels = typeof e.labels === 'string' ? JSON.parse(e.labels) : e.labels;
        if (Array.isArray(labels) && labels.length > 0) {
          parts.push(`Labels: ${labels.join(', ')}`);
        }
      } catch {}
    }

    // Use body_text if available (first 500 chars), otherwise snippet
    if (e.body_text && e.body_text.length > 0) {
      parts.push(`Body: ${e.body_text.slice(0, 500)}`);
    } else if (e.snippet) {
      parts.push(`Snippet: ${e.snippet.slice(0, 300)}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

export const SUMMARIZE_SYSTEM = `Analyze user email triage decisions and write a concise preference profile (1-2 paragraphs).
Focus on patterns: which senders/domains/categories the user always approves or dismisses, what action types matter most, any stated reasons.
Be specific — name domains, categories, and patterns. This profile will be injected into future triage prompts.
Return JSON only: {"profile": "..."}`;

export function buildSummarizeMessage(decisions) {
  const lines = decisions.map(d => {
    const label = d.decision === 'create_task' ? 'CREATED TASK' : d.decision.toUpperCase();
    return `- ${label}: from "${d.sender_email}", subject "${d.subject}"` +
      (d.category_name ? ` [${d.category_name}]` : '') +
      (d.reason ? ` — user note: "${d.reason}"` : '');
  });
  return `${decisions.length} user decisions:\n${lines.join('\n')}`;
}
