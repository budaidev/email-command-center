export const SYSTEM = 'You are a JSON extractor. Return only valid JSON, no markdown.';

export function buildUserMessage(summaryContent) {
  return `Extract references from this email summary. Return JSON:
{"references": [{"type": "action|date|contact|amount|link", "content": "description", "due_date": "YYYY-MM-DD or null"}]}

Return {"references": []} if nothing notable.

Summary:
${summaryContent.slice(0, 3000)}`;
}
