/**
 * Langfuse prompt management: fetch a prompt by name and label over the public
 * REST API, cached for a few minutes. Falls back to the caller's local text when
 * Langfuse is unreachable or not configured, so evaluation never stops on it.
 *
 * Env: LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY (the LiteLLM
 * project's keys: prompts and LiteLLM's traces live in the same project).
 */

const HOST = process.env.LANGFUSE_HOST;
const PK = process.env.LANGFUSE_PUBLIC_KEY;
const SK = process.env.LANGFUSE_SECRET_KEY;
const TTL_MS = 5 * 60_000;

const cache = new Map(); // key -> { at, value }

/** Returns { text, name, version, source: 'langfuse' | 'local', error? }.
 *  A numeric `version` picks that version instead of the label (backtests). */
export async function getTextPrompt(name, label, localText, { version } = {}) {
  const key = version ? `${name}#${version}` : `${name}@${label}`;
  const query = version ? `version=${encodeURIComponent(version)}` : `label=${encodeURIComponent(label)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const local = { text: localText, name, version: null, source: 'local' };
  if (!HOST || !PK || !SK) return { ...local, error: 'Langfuse not configured' };
  try {
    const res = await fetch(`${HOST}/api/public/v2/prompts/${encodeURIComponent(name)}?${query}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${PK}:${SK}`).toString('base64')}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();
    if (typeof p.prompt !== 'string') throw new Error('not a text prompt');
    const value = { text: p.prompt, name, version: p.version, source: 'langfuse' };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.warn(`[Langfuse] prompt ${key} unavailable, using the local copy: ${err.message}`);
    // Keep the last good Langfuse version if there is one.
    if (hit) return hit.value;
    return { ...local, error: err.message };
  }
}
