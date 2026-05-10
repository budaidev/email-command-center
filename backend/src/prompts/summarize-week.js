export const SYSTEM = 'You are an email analyst. Be concise and accurate.';

export function buildUserMessage(week, emails) {
  const header = `Create a weekly review for ${week} (${emails.length} emails). Format as:\n\n## Overview\n[2-3 sentences]\n\n## Major Threads\n- [thread: summary and status]\n\n## Pending Actions\n- [follow-ups needed, None if clear]\n\n## Key Contacts\n- [most active contacts]\n\n---\n`;
  const bodies = emails.map(e =>
    `${e.date.slice(0, 10)} | From: ${e.sender_email} | Subject: ${e.subject}\n${(e.snippet || '').slice(0, 200)}`
  ).join('\n---\n');
  return (header + bodies).slice(0, 15000);
}
