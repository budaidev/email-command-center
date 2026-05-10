export const SYSTEM = 'You are an email and calendar analyst. Return only valid JSON, no markdown code fences.';

export function buildUserMessage(date, categoryGroups, events = []) {
  const parts = [`Generate a structured daily digest for ${date}.`];
  parts.push('Each email has an [id] tag - use these exact IDs when referencing emails.');
  parts.push('');

  // Calendar events section
  if (events.length > 0) {
    parts.push(`=== CALENDAR EVENTS (${events.length}) ===`);
    for (const ev of events) {
      const time = ev.all_day ? 'All day' : new Date(ev.dtstart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const loc = ev.location ? ` @ ${ev.location}` : '';
      parts.push(`- ${time}: ${ev.summary || '(no title)'}${loc}`);
      if (ev.description) parts.push(`  ${ev.description.slice(0, 150)}`);
    }
    parts.push('');
  }

  // Email sections by category (limit per group to avoid exceeding model output capacity)
  for (const group of categoryGroups) {
    const label = group.name || 'Uncategorized';
    const shown = group.emails.slice(0, 8);
    const extra = group.emails.length - shown.length;
    parts.push(`=== ${label} (${group.emails.length} emails${extra > 0 ? `, showing top ${shown.length}` : ''}) ===`);
    for (const e of shown) {
      const snippet = (e.snippet || '').slice(0, 150);
      parts.push(`- [id:${e.id}] From: ${e.sender_name || e.sender_email} | Subject: ${e.subject || '(no subject)'}\n  ${snippet}`);
    }
    if (extra > 0) parts.push(`  ... and ${extra} more similar emails`);
    parts.push('');
  }

  parts.push('Return JSON with this exact structure:');
  parts.push(JSON.stringify({
    summary: 'A short paragraph (2-4 sentences) summarizing the day: what happened, what needs attention, what was handled automatically.',
    highlights: [
      {
        title: 'Short descriptive title of the item',
        body: '1-2 sentence explanation of what this is about and why it matters',
        emailId: 'the id from the [id:xxx] tag of the source email',
        kind: 'decision',
      },
      {
        title: 'Another item title',
        body: 'Explanation',
        emailId: 'email-id-here',
        kind: 'fyi',
      },
    ],
    fyi: [
      { title: '12 receipts auto-filed', kind: 'auto', count: 12 },
      { title: 'Jordan intro: Dana', kind: 'light', emailId: 'email-id-if-relevant' },
    ],
    categories: [
      { category_id: 'uuid|null', name: 'Category Name', color: '#hex', email_count: 0, summary: '2-3 sentence summary', top_subjects: ['Subject 1'] },
    ],
    uncategorized: { email_count: 0, summary: '...', top_subjects: ['...'] },
    events: events.length > 0
      ? [{ time: 'HH:MM or All day', summary: 'event title', location: 'if any' }]
      : [],
    headline: '1-2 sentence overview of the day including key events',
  }));

  parts.push('');
  parts.push('CLASSIFICATION RULES for highlights:');
  parts.push('- kind:"decision" = the user likely needs to RESPOND, APPROVE, SCHEDULE, CHOOSE, or TAKE ACTION. Examples: contract review requests, interview scheduling, meeting proposals, questions awaiting reply, approval requests.');
  parts.push('- kind:"fyi" = informational, already handled, or no response needed. Examples: calendar confirmations, status updates, shipped notifications, auto-booked meetings.');
  parts.push('');
  parts.push('RULES for fyi array (separate from highlights):');
  parts.push('- kind:"auto" = batch of similar emails that were auto-categorized (receipts, newsletters, etc). Include a "count" field.');
  parts.push('- kind:"light" = a single noteworthy email that doesn\'t need action but the user should know about (introductions, FYI CCs, etc). Include "emailId" if from a specific email.');
  parts.push('');
  parts.push('IMPORTANT:');
  parts.push('- Every highlight MUST include emailId from the source email [id:xxx] tag.');
  parts.push('- Put genuinely actionable items in highlights with kind:"decision". Be selective — not every email is a decision.');
  parts.push('- Group auto-handled categories into the fyi array with kind:"auto" and a count.');
  parts.push('- The summary field should give a morning-briefing overview of the whole day.');
  parts.push('- Keep the summary to 2-3 sentences max. Keep highlight bodies to 1 sentence. Be concise — the UI has limited space.');
  parts.push('- Limit highlights to the 5 most important items. Limit fyi to 4 items. Do not list every email.');

  return parts.join('\n').slice(0, 14000);
}
