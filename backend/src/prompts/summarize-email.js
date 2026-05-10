export const SYSTEM = 'You are an email analyst. Be concise and accurate.';

export function buildUserMessage(email) {
  const body = (email.body_text || email.snippet || '(no body)').slice(0, 8000);
  const header = `From: ${email.sender_name ? `${email.sender_name} <${email.sender_email}>` : email.sender_email}
Subject: ${email.subject}
Date: ${new Date(email.date).toLocaleString()}

${body}`;

  return `Analyze this email. Reply with these sections:
## TL;DR ## Key Points ## Actions ## Key Info (contacts/amounts/dates/links)
Write "None" under sections with nothing notable.
---
${header}`;
}
