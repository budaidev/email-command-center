/**
 * Deterministic signals (card #246): facts about an email computed without an LLM,
 * when it is first prepared (bodies and signals come from one fetch of the raw
 * message on the local mailserver). They feed hard rules, the confidence tiers and
 * later a classic classifier; scripts/signal-report.js measures each one against
 * the owner's labels.
 *
 * Nothing here may depend on what happened after the email arrived (whether the
 * owner replied, starred or read it): that would leak the answer into the test.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import db from '../db.js';
import { fetchBodies } from './imap.js';

export const SIGNALS_VERSION = 4; // 2: owner's history from the sent-mail index; 3: security alert, verification code; 4: list_id_value, github_repo


const OWNER = new Set((process.env.OWNER_ADDRESSES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

// Headers of the owner's sent mail, written by mailserver/config/gmail_sync.py (one
// JSON object per line: date, to[], message_id, in_reply_to, references[]). The file
// only grows, so a size change means new lines (mtime is unreliable on this NAS).
const SENT_INDEX = process.env.SENT_INDEX_PATH || '/app/mailstate/sent_index.jsonl';
let sent = { size: -1, firstTo: new Map(), ids: new Map() };

function sentIndex() {
  if (!existsSync(SENT_INDEX)) return null;
  const size = statSync(SENT_INDEX).size;
  if (size === sent.size) return sent;
  const firstTo = new Map(); // address -> earliest time the owner wrote to it
  const ids = new Map();     // Message-ID of a sent mail -> its time
  for (const line of readFileSync(SENT_INDEX, 'utf8').split('\n')) {
    if (!line) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    const t = r.date ? Date.parse(r.date) : NaN;
    if (Number.isNaN(t)) continue;
    for (const a of r.to || []) if (!(firstTo.get(a) <= t)) firstTo.set(a, t);
    if (r.message_id) ids.set(r.message_id, t);
  }
  sent = { size, firstTo, ids };
  return sent;
}

const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'freemail.hu', 'citromail.hu', 'outlook.com', 'hotmail.com',
  'yahoo.com', 'icloud.com', 't-online.hu', 'seznam.cz', 'proton.me', 'protonmail.com']);
const NOREPLY = /^(no-?reply|do-?not-?reply|donotreply|noreply-[\w-]+|[\w.-]*-noreply|notifications?|notify|mailer(-daemon)?|bounce[\w-]*)@/i;
const ROLE = /^(info|news|newsletter|hirlevel|marketing|hello|hi|team|support|ugyfelszolgalat|service|billing|szamla|invoice|ertesites|ertesito|automail|system|admin)@/i;

// Stems, not words: Hungarian suffixes (befizetés, befizetését, befizetési).
const KEYWORDS = {
  payment: /fizetési határid|befizet|díjfizet|dijfizet|fizetendő|fizetési felszólít|tartozás|hátralék|esedékes|díjbekérő|dijbekero|kiegyenlít|átutalás|payment due|amount due|overdue|outstanding balance|please pay|invoice due|pay by|payment failed|sikertelen fizetés|sikertelen terhelés/i,
  receipt: /nyugta|sikeres fizetés|fizetés sikeres|köszönjük (a )?(vásárlás|rendelés|befizet)|receipt|payment received|payment confirmation|order confirm|rendelés visszaigazol|visszaigazolás/i,
  deadline: /határid|lejár|deadline|due date|legkésőbb|until \d|by (monday|tuesday|wednesday|thursday|friday)/i,
  appointment: /időpont|találkoz|egyeztet|megbeszél|fogadóór|szülői értekezlet|vizsga|tárgyalás|interjú|interview|meeting|appointment|reschedul|calendar invite|meghívó.*(\d{1,2}:\d{2})|\b\d{1,2}:\d{2}\b.*(óra|kor)/i,
  reply_request: /kérlek,? (jelezd|írd|válaszolj|küldd)|kérem,? (jelezze|írja|válaszoljon|küldje)|várom (a )?válasz|visszajelz|let me know|please (confirm|reply|respond|advise|let)|could you|can you|would you|tudnál|tudnád|tudná|\?\s*$/im,
  // Account security notices: "was it you?" mail, mostly the owner's own sign-ins.
  security: /security alert|biztonsági (riasztás|figyelmeztetés|értesítés)|new sign-?in|new login|sign-?in attempt|új bejelentkezés|bejelentkezés(t)? észlelt|unusual (activity|sign-?in)|szokatlan|new (trusted )?device|új eszköz|account protection|fiókvédelem|password (was )?(changed|reset)|jelszó(t)? (megváltozott|módosít)|was this you|te voltál/i,
  // Subject only: in bodies "OTP" is also a bank and "verify" is in every footer.
  verification_code: /verification code|security code|one-?time (passcode|password|code)|ellenőrző kód|megerősítő kód|egyszer használatos|verify your identity|is your .*code|kódod|bejelentkezési kód|login code|sign-?in code/i,
  unsubscribe_text: /leiratkoz|unsubscribe|hírlevél|newsletter|this email was sent to|you are receiving this/i,
};

const addr = a => String(a || '').toLowerCase().trim();
const domainOf = a => addr(a).split('@')[1] || '';

// Sender domain categories, edited in the UI (table domain_categories, card #247).
let domainCache = null;
export function invalidateDomainCategories() { domainCache = null; }

/** Category of a sender domain (suffix match: "example.hu" covers "x.example.hu"), or null. */
export function domainCategoryOf(domain) {
  if (!domainCache) domainCache = db.prepare('SELECT domain, category FROM domain_categories').all();
  const d = String(domain || '').toLowerCase();
  const hit = domainCache.find(r => d === r.domain || d.endsWith(`.${r.domain}`));
  return hit ? hit.category : null;
}

/** The body without quoted earlier messages, so keywords come from this message only. */
function ownText(body) {
  const lines = String(body || '').split('\n');
  const out = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^(On .+ wrote:|.+ ezt írta.*:|-{2,} ?(Original|Forwarded|Eredeti|Továbbított) ?(Message|üzenet)|From: .+)$/i.test(line.trim())) break;
    out.push(line);
  }
  return out.join('\n');
}

function listIdOf(raw) {
  if (!raw) return null;
  let v = raw;
  try { const o = JSON.parse(raw); v = typeof o === 'string' ? o : (o.id || o.name || raw); } catch { /* plain header */ }
  return String(v).replace(/[<>"]/g, '').trim().toLowerCase().slice(0, 200) || null;
}

function history(email, h) {
  const idx = sentIndex();
  if (!idx) return { owner_wrote_to_sender_before: null, owner_replied_in_thread_before: null };
  const at = Date.parse(email.date);
  const before = t => t !== undefined && (Number.isNaN(at) || t < at);
  const thread = `${h['in-reply-to'] || ''} ${h.references || ''}`.match(/<[^>]+>/g) || [];
  return {
    owner_wrote_to_sender_before: before(idx.firstTo.get(addr(email.sender_email))),
    owner_replied_in_thread_before: thread.some(id => before(idx.ids.get(id))),
  };
}

/**
 * meta: { headers: {lowercase name: string}, to: [addr], cc: [addr], attachments: [{filename, contentType}] }
 * from imap.fetchBodies. Returns a flat JSON object; null means "unknown".
 */
export function computeSignals(email, meta) {
  const h = meta?.headers || {};
  const from = addr(email.sender_email);
  const domain = domainOf(from);
  const to = (meta?.to || []).map(addr);
  const cc = (meta?.cc || []).map(addr);
  const subject = String(email.subject || '');
  const text = `${subject}\n${ownText(email.body_text || email.snippet || '')}`;
  const atts = meta?.attachments || [];
  const has = re => re.test(text);

  return {
    // Bulk / automated
    list_unsubscribe: !!h['list-unsubscribe'],
    list_id: !!h['list-id'],
    // The list's id, e.g. dev.fineract.apache.org (mailparser gives {id, name} as JSON).
    list_id_value: listIdOf(h['list-id']),
    precedence_bulk: /bulk|list|junk/i.test(h.precedence || ''),
    auto_submitted: !!h['auto-submitted'] && !/^no$/i.test(h['auto-submitted']),
    esp_feedback_id: !!h['feedback-id'] || !!h['x-campaign-id'] || !!h['x-mailgun-tag'] || !!h['x-sg-eid'],
    noreply_sender: NOREPLY.test(from),
    role_sender: ROLE.test(from),
    unsubscribe_text: has(KEYWORDS.unsubscribe_text),
    // Who sent it, to whom
    sender_domain: domain,
    domain_category: domainCategoryOf(domain), // stored for reference; rules use the live table
    freemail_sender: FREEMAIL.has(domain),
    owner_in_to: to.some(a => OWNER.has(a)),
    owner_in_cc_only: !to.some(a => OWNER.has(a)) && cc.some(a => OWNER.has(a)),
    recipient_count: to.length + cc.length,
    from_owner: OWNER.has(from),
    // Thread shape
    is_reply: /^\s*(re|vá|válasz|aw)\s*:/i.test(subject) || !!h['in-reply-to'],
    is_forward: /^\s*(fwd?|továbbítás|tov)\s*:/i.test(subject),
    github_reason: h['x-github-reason'] || null,
    github_repo: (subject.match(/^(?:re:\s*)?\[([\w.-]+\/[\w.-]+)\]/i) || [])[1]?.toLowerCase() || null,
    // Content (this message only, not the quoted thread)
    kw_payment: has(KEYWORDS.payment),
    kw_receipt: has(KEYWORDS.receipt),
    kw_deadline: has(KEYWORDS.deadline),
    kw_appointment: has(KEYWORDS.appointment),
    kw_reply_request: has(KEYWORDS.reply_request),
    kw_security: has(KEYWORDS.security),
    kw_verification_code: KEYWORDS.verification_code.test(subject),
    // Attachments
    att_pdf: atts.some(a => /pdf/i.test(a.contentType) || /\.pdf$/i.test(a.filename || '')),
    att_calendar: atts.some(a => /calendar|ics/i.test(a.contentType) || /\.ics$/i.test(a.filename || '')),
    att_invoice: atts.some(a => /sz[aá]mla|invoice|d[ií]jbek[eé]r|bill/i.test(a.filename || '')),
    // Owner's history, strictly before this email arrived (null: no sent index).
    ...history(email, h),
  };
}

const saveSignals = db.prepare(`INSERT INTO email_signals (email_id, version, signals, computed_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(email_id) DO UPDATE SET version = excluded.version, signals = excluded.signals, computed_at = excluded.computed_at`);
const saveBody = db.prepare('UPDATE emails SET body_text = ?, snippet = COALESCE(NULLIF(snippet, \'\'), ?) WHERE id = ?');
const currentSignals = db.prepare('SELECT signals FROM email_signals WHERE email_id = ? AND version = ?');

/** Stored signals of the current version, or null. */
export function getSignals(emailId) {
  const r = currentSignals.get(emailId, SIGNALS_VERSION);
  return r ? JSON.parse(r.signals) : null;
}

/**
 * Make sure each email (rows with id, account_id, uid, subject, sender_email,
 * body_text, snippet) has a body and current signals; fetches the raw message
 * from the local mailserver once for those that lack either, and stores both.
 * Sets email.body_text and email.signals in place. Failures leave them empty.
 */
export async function prepareEmails(emails) {
  const todo = [];
  for (const e of emails) {
    e.signals = getSignals(e.id);
    const hasBody = e.body_text && e.body_text.trim();
    if ((!hasBody || !e.signals) && e.account_id && e.uid) todo.push(e);
  }
  const byAccount = new Map();
  for (const e of todo) {
    if (!byAccount.has(e.account_id)) byAccount.set(e.account_id, []);
    byAccount.get(e.account_id).push(e);
  }
  for (const [accountId, list] of byAccount) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) continue;
    for (let i = 0; i < list.length; i += 200) {
      const chunk = list.slice(i, i + 200);
      try {
        const fetched = await fetchBodies(account, chunk.map(e => e.uid));
        db.transaction(() => {
          for (const e of chunk) {
            const f = fetched.get(e.uid);
            if (!f) continue;
            if (!(e.body_text && e.body_text.trim())) {
              e.body_text = f.body_text;
              e.snippet = e.snippet || f.snippet;
              saveBody.run(f.body_text, f.snippet, e.id);
            }
            e.signals = computeSignals(e, f.meta);
            saveSignals.run(e.id, SIGNALS_VERSION, JSON.stringify(e.signals));
          }
        })();
      } catch (err) {
        console.warn(`[Signals] could not fetch ${chunk.length} messages for ${accountId}: ${err.message}`);
      }
    }
  }
}
