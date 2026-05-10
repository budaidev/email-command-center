export const SYSTEM = 'You are an email analyst. Be concise and accurate.';

export function buildUserMessage(date, emails) {
  const header = `Create a daily digest for ${date} (${emails.length} emails). Format as:\n\n## Overview\n[2-3 sentences]\n\n## Threads\n- [topic: summary]\n\n## Actions\n- [action items, None if clear]\n\n## Key Contacts\n- [contacts, None if unremarkable]\n\n---\n`;
  const bodies = emails.map(e =>
    `From: ${e.sender_email} | Subject: ${e.subject}\n${(e.snippet || '').slice(0, 300)}`
  ).join('\n---\n');
  return (header + bodies).slice(0, 12000);
}
