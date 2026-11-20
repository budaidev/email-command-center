/**
 * Deadline guess (card #242): the first date in an email that reads like a deadline,
 * to prefill a task's due date. No LLM: Hungarian and English date forms near words
 * like "határidő", "-ig", "legkésőbb", "until", "by". Returns 'YYYY-MM-DD' or null.
 *
 * Dates without a year take the email's year (or the next one when that lands
 * well before the email). Only dates from the email's day up to 180 days later count.
 */

const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const EN_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthOf = w => {
  const s = w.toLowerCase().replace(/\.$/, '');
  const i = HU_MONTHS.findIndex(m => m.startsWith(s) && s.length >= 3);
  if (i >= 0) return i + 1;
  const j = EN_MONTHS.findIndex(m => m.startsWith(s) && s.length >= 3);
  return j >= 0 ? j + 1 : null;
};
const MONTH_WORD = '(jan(?:uár)?|febr?(?:uár)?|márc(?:ius)?|ápr(?:ilis)?|máj(?:us)?|jún(?:ius)?|júl(?:ius)?|aug(?:usztus)?|szept(?:ember)?|okt(?:óber)?|nov(?:ember)?|dec(?:ember)?|january|february|march|april|may|june|july|august|september|october|november|december|feb|mar|apr|jun|jul|sep|sept|oct)\\.?';

const PATTERNS = [
  // 2026.11.20. / 2026. 11. 20. / 2026-11-20 / 2026/11/20
  { re: /\b(20\d\d)[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})\b/g, get: m => [m[1], m[2], m[3]] },
  // 2026. november 20.
  { re: new RegExp(`\\b(20\\d\\d)\\.?\\s+${MONTH_WORD}\\s+(\\d{1,2})\\b`, 'gi'), get: m => [m[1], monthOf(m[2]), m[3]] },
  // november 20. / nov. 20-ig
  { re: new RegExp(`(?<![\\w.])${MONTH_WORD}\\s+(\\d{1,2})\\b`, 'gi'), get: m => [null, monthOf(m[1]), m[2]] },
  // 20 November / 20. november
  { re: new RegExp(`\\b(\\d{1,2})\\.?\\s+${MONTH_WORD}(?![\\w])`, 'gi'), get: m => [null, monthOf(m[2]), m[1]] },
  // 11.17. (Hungarian month.day. without year; needs the closing dot)
  { re: /(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.(?!\d)/g, get: m => [null, m[1], m[2]] },
  // 11/24/2026 (US) is rare in this mail; left out on purpose (ambiguous with 24/11).
];

const KEYWORD = /határid|-ig\b|legkésőbb|lejár|utolsó nap|átvehet|átvétel|fizetendő|esedékes|until|by\b|before|due|deadline|expires?|no later than|időpont|találkoz|interjú|interview|meeting|appointment|schedule/i; // appointments: the event date is the due date

function toDate(y, mo, d, emailAt) {
  mo = Number(mo); d = Number(d);
  if (!mo || mo > 12 || !d || d > 31) return null;
  let year = y ? Number(y) : emailAt.getUTCFullYear();
  let t = Date.UTC(year, mo - 1, d);
  if (!y && t < emailAt.getTime() - 7 * 86400000) t = Date.UTC(++year, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCMonth() !== mo - 1) return null; // 31 Feb
  return dt;
}

export function guessDue(text, emailDate) {
  const body = String(text || '').replace(/\s+/g, ' ');
  if (!body) return null;
  const emailAt = new Date(emailDate || Date.now());
  if (Number.isNaN(emailAt.getTime())) return null;
  const from = Date.UTC(emailAt.getUTCFullYear(), emailAt.getUTCMonth(), emailAt.getUTCDate());
  const cands = [];
  for (const { re, get } of PATTERNS) {
    for (const m of body.matchAll(re)) {
      const [y, mo, d] = get(m);
      const dt = toDate(y, mo, d, emailAt);
      if (!dt || dt.getTime() < from || dt.getTime() > from + 180 * 86400000) continue;
      // A deadline word in the 80 characters before or 15 after the date.
      const ctx = body.slice(Math.max(0, m.index - 80), m.index + m[0].length + 15);
      cands.push({ at: m.index, dt, keyword: KEYWORD.test(ctx) });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => (b.keyword - a.keyword) || (a.at - b.at));
  return cands[0].keyword ? cands[0].dt.toISOString().slice(0, 10) : null;
}
