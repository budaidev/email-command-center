export function buildSuggestRulesPrompt(categories, uncategorizedEmails) {
  const catList = categories.map(c => {
    const ruleStr = c.rules.map(r => `${r.field} ${r.operator} "${r.value}"`).join(', ')
    return `- ${c.name} (${c.behavior}): ${ruleStr || 'no rules yet'}`
  }).join('\n')

  const emailList = uncategorizedEmails.map((e, i) => {
    let recip = ''
    try {
      const r = JSON.parse(e.recipients || '[]')
      if (r.length) recip = ` | To: ${r.map(x => x.email).join(', ')}`
    } catch {}
    return `${i + 1}. From: ${e.sender_email} | Subj: ${(e.subject || '').slice(0, 70)}${recip}`
  }).join('\n')

  const system = 'Analyze uncategorized emails and suggest categorization rules. Return JSON only: {"suggestions":[{"category":"name","is_new_category":false,"color":"#hex (only if new)","behavior":"digest-only (only if new)","rule":{"field":"sender_domain|sender_email|sender_name|subject|recipient_domain|recipient_email","operator":"contains|equals|starts_with|ends_with","value":"..."},"reason":"short reason"}]}'

  const user = `Existing categories:\n${catList}\n\nUncategorized sample:\n${emailList}\n\nSuggest 6-10 rules. Prefer sender_domain rules. Group similar senders. Reuse existing categories where fitting.`

  return { system, user }
}
