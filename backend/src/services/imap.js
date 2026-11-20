import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { decrypt } from '../utils/crypto.js';

/**
 * Create an ImapFlow client for an account.
 * Credentials are stored encrypted; we decrypt before connecting.
 */
function createClient(account) {
  return new ImapFlow({
    host: process.env.IMAP_HOST || 'localhost',
    port: parseInt(process.env.IMAP_PORT || '143'),
    secure: false,        // STARTTLS on port 143
    auth: {
      user: account.imap_user,
      pass: decrypt(account.imap_pass),
    },
    tls: {
      rejectUnauthorized: false,  // allow self-signed certs on local mail server
    },
    logger: false,
  });
}

/**
 * Fetch the last N messages from INBOX.
 * Returns lightweight envelope objects (no body).
 */
export async function fetchEnvelopes(account, limit = 500) {
  const client = createClient(account);
  const messages = [];

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');
    const total = mailbox.exists;

    if (total === 0) return [];

    // Fetch newest `limit` messages by sequence range
    const start = Math.max(1, total - limit + 1);
    const range = `${start}:${total}`;

    for await (const msg of client.fetch(range, {
      uid: true,
      flags: true,
      envelope: true,
      internalDate: true,
    })) {
      messages.push({
        uid: msg.uid,
        subject: msg.envelope.subject || '(no subject)',
        sender_name: msg.envelope.from?.[0]?.name || '',
        sender_email: msg.envelope.from?.[0]?.address || '',
        recipients: JSON.stringify(
          (msg.envelope.to || []).map(a => ({ name: a.name, email: a.address }))
        ),
        // The mail's own Date header; INTERNALDATE is when the mailserver received it,
        // which after a sync backlog can be weeks later.
        date: (msg.envelope.date || msg.internalDate || new Date()).toISOString(),
        received_at: msg.internalDate?.toISOString() || null,
        message_id: msg.envelope.messageId || null,
        is_read: msg.flags.has('\\Seen') ? 1 : 0,
        labels: JSON.stringify([...msg.flags]),
      });
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return messages;
}

/**
 * Fetch full message body for a single UID.
 */
export async function fetchMessage(account, uid) {
  const client = createClient(account);

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    let rawMessage = null;
    for await (const msg of client.fetch({ uid }, { uid: true, source: true })) {
      rawMessage = msg.source;
    }

    if (!rawMessage) return null;

    const parsed = await simpleParser(rawMessage);

    return {
      uid,
      subject: parsed.subject || '(no subject)',
      sender_name: parsed.from?.value?.[0]?.name || '',
      sender_email: parsed.from?.value?.[0]?.address || '',
      recipients: JSON.stringify(
        (parsed.to?.value || []).map(a => ({ name: a.name, email: a.address }))
      ),
      date: parsed.date?.toISOString() || new Date().toISOString(),
      body_text: parsed.text || '',
      body_html: parsed.html || parsed.textAsHtml || '',
      snippet: (parsed.text || '').slice(0, 200).replace(/\s+/g, ' ').trim(),
      message_id: parsed.messageId || null,
    };
  } finally {
    await client.logout().catch(() => {});
  }
}

const META_HEADERS = ['list-unsubscribe', 'list-id', 'precedence', 'auto-submitted', 'feedback-id', 'x-campaign-id',
  'x-mailgun-tag', 'x-sg-eid', 'in-reply-to', 'references', 'x-github-reason'];

/** What services/signals.js needs from a parsed message besides the body. */
function messageMeta(parsed) {
  const headers = {};
  for (const name of META_HEADERS) {
    const v = parsed.headers.get(name);
    if (v === undefined || v === null) continue;
    headers[name] = typeof v === 'string' ? v : (v.text ?? v.value ?? JSON.stringify(v));
    if (Array.isArray(headers[name])) headers[name] = headers[name].join(' ');
    headers[name] = String(headers[name]).slice(0, 500);
  }
  // mailparser folds List-* headers into one structured "list" header.
  const listHeader = parsed.headers.get('list') || {};
  if (listHeader.unsubscribe) headers['list-unsubscribe'] = JSON.stringify(listHeader.unsubscribe).slice(0, 500);
  if (listHeader.id) headers['list-id'] = JSON.stringify(listHeader.id).slice(0, 500);
  const list = a => (a ? (Array.isArray(a) ? a : [a]).flatMap(x => x.value || []).map(x => x.address).filter(Boolean) : []);
  return {
    headers,
    to: list(parsed.to),
    cc: list(parsed.cc),
    attachments: (parsed.attachments || []).map(a => ({ filename: a.filename || null, contentType: a.contentType || null })),
  };
}

/**
 * Plain-text bodies (and header meta for the signals) for several INBOX uids over one connection (card #239: the
 * importance evaluation reads the body, which the sync does not store).
 * Returns Map(uid -> { body_text, snippet, meta }).
 */
export async function fetchBodies(account, uids) {
  const out = new Map();
  if (!uids.length) return out;
  const client = createClient(account);
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    for await (const msg of client.fetch(uids.join(','), { uid: true, source: true }, { uid: true })) {
      const parsed = await simpleParser(msg.source);
      let text = parsed.text || '';
      if (!text.trim() && parsed.html) {
        text = parsed.html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n');
      }
      out.set(msg.uid, { body_text: text, snippet: text.slice(0, 200).replace(/\s+/g, ' ').trim(), meta: messageMeta(parsed) });
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

/**
 * Fetch new messages since a given UID (incremental sync).
 */
export async function fetchSince(account, sinceUid) {
  const client = createClient(account);
  const messages = [];

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');

    if (mailbox.exists === 0) return [];

    const range = `${sinceUid + 1}:*`;

    for await (const msg of client.fetch({ uid: `${sinceUid + 1}:*` }, {
      uid: true,
      flags: true,
      envelope: true,
      internalDate: true,
    })) {
      if (msg.uid <= sinceUid) continue; // safety guard
      messages.push({
        uid: msg.uid,
        subject: msg.envelope.subject || '(no subject)',
        sender_name: msg.envelope.from?.[0]?.name || '',
        sender_email: msg.envelope.from?.[0]?.address || '',
        recipients: JSON.stringify(
          (msg.envelope.to || []).map(a => ({ name: a.name, email: a.address }))
        ),
        // The mail's own Date header; INTERNALDATE is when the mailserver received it,
        // which after a sync backlog can be weeks later.
        date: (msg.envelope.date || msg.internalDate || new Date()).toISOString(),
        received_at: msg.internalDate?.toISOString() || null,
        message_id: msg.envelope.messageId || null,
        is_read: msg.flags.has('\\Seen') ? 1 : 0,
        labels: JSON.stringify([...msg.flags]),
      });
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return messages;
}

/**
 * Mark a message as read.
 */
export async function markRead(account, uid) {
  const client = createClient(account);
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    await client.messageFlagsAdd({ uid }, ['\\Seen']);
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Delete a message permanently (move to Trash then expunge).
 */
export async function deleteMessage(account, uid) {
  const client = createClient(account);
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    // Try MOVE to Trash first; fall back to \Deleted + expunge
    try {
      await client.messageMove({ uid }, 'Trash');
    } catch {
      await client.messageFlagsAdd({ uid }, ['\\Deleted']);
      await client.mailboxClose();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Archive a message — move to Archive folder (create if needed).
 */
export async function archiveMessage(account, uid) {
  const client = createClient(account);
  try {
    await client.connect();

    // Ensure Archive mailbox exists
    const mailboxes = await client.list();
    const hasArchive = mailboxes.some(m =>
      m.name === 'Archive' || m.path === 'Archive'
    );
    if (!hasArchive) {
      await client.mailboxCreate('Archive');
    }

    await client.mailboxOpen('INBOX');
    await client.messageMove({ uid }, 'Archive');
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Open a persistent IMAP IDLE connection for real-time new mail push.
 * Calls onNew(account) whenever EXISTS increases (new mail arrived).
 * Returns a stop() function to close the connection.
 */
export function watchInbox(account, onNew) {
  let client = null;
  let stopped = false;
  let reconnectTimer = null;

  async function connect() {
    if (stopped) return;
    try {
      client = createClient(account);
      await client.connect();
      const mailbox = await client.mailboxOpen('INBOX');
      let knownExists = mailbox.exists;

      // Listen for EXISTS updates (new messages)
      client.on('exists', (data) => {
        if (data.count > knownExists) {
          knownExists = data.count;
          onNew(account).catch(err =>
            console.error(`[IDLE] onNew error for ${account.email}:`, err.message)
          );
        }
      });

      // Start IDLE loop — imapflow handles IDLE re-issue every 29 min
      await client.idle();

      // idle() resolves when connection drops or stop() is called
      if (!stopped) {
        console.log(`[IDLE] ${account.email} — reconnecting in 5s`);
        reconnectTimer = setTimeout(connect, 5000);
      }
    } catch (err) {
      if (!stopped) {
        console.error(`[IDLE] ${account.email} error: ${err.message} — reconnecting in 15s`);
        reconnectTimer = setTimeout(connect, 15000);
      }
    }
  }

  connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(reconnectTimer);
      client?.close().catch(() => {});
    },
  };
}

/**
 * Test connectivity + auth for an account.
 * Returns { ok: true } or throws.
 */
export async function testConnection(imapUser, imapPassPlain) {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'localhost',
    port: parseInt(process.env.IMAP_PORT || '143'),
    secure: false,
    auth: { user: imapUser, pass: imapPassPlain },
    tls: { rejectUnauthorized: false },
    logger: false,
  });

  await client.connect();
  await client.logout();
  return { ok: true };
}
