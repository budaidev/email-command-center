export function buildSuggestTagsPrompt(email, existingTags) {
  const system = 'Suggest 2-4 short tags for this email. Reply JSON only: {"tags":["tag1","tag2"]}';
  const tagHint = existingTags.length
    ? `Existing tags (reuse if fitting): ${existingTags.map(t => t.name).join(', ')}\n`
    : '';
  const body = (email.body_text || email.snippet || '').slice(0, 800);
  const user = `${tagHint}Subject: ${(email.subject || '').slice(0, 120)}\n${body}`;
  return { system, user };
}
