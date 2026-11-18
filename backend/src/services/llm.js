import OpenAI from 'openai';

// --- Primary LLM endpoint ---
// In the LiteLLM-routed setup this points at litellm:4000 with the master key;
// it can also point at a raw vLLM/llama.cpp endpoint that ignores auth.
const PRIMARY_BASE_URL = process.env.LLM_PRIMARY_BASE_URL || 'http://localhost:8001/v1';
const PRIMARY_MODEL = process.env.LLM_PRIMARY_MODEL || 'default';
const PRIMARY_API_KEY = process.env.LLM_PRIMARY_API_KEY || 'not-needed';

// --- Fallback LLM endpoint ---
// Used only when the primary /models probe fails. LiteLLM already does its own
// per-model fallback chain, so when PRIMARY is LiteLLM this only kicks in if
// LiteLLM itself is down.
const FALLBACK_BASE_URL = process.env.LLM_FALLBACK_BASE_URL || 'http://localhost:8002/v1';
const FALLBACK_API_KEY = process.env.LLM_FALLBACK_API_KEY || 'not-needed';
const FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL || 'default';

let _primaryAvailable = null; // null = not checked yet
let _lastCheck = 0;
const CHECK_INTERVAL_MS = 60_000; // re-check every 60s

const _primaryAuthHeader = PRIMARY_API_KEY && PRIMARY_API_KEY !== 'not-needed'
  ? { Authorization: `Bearer ${PRIMARY_API_KEY}` }
  : {};

async function isPrimaryAvailable() {
  const now = Date.now();
  if (_primaryAvailable !== null && now - _lastCheck < CHECK_INTERVAL_MS) {
    return _primaryAvailable;
  }
  try {
    const res = await fetch(`${PRIMARY_BASE_URL}/models`, {
      signal: AbortSignal.timeout(3000),
      headers: _primaryAuthHeader,
    });
    _primaryAvailable = res.ok;
  } catch {
    _primaryAvailable = false;
  }
  _lastCheck = now;
  console.log(`[LLM] Primary endpoint ${_primaryAvailable ? 'available' : 'unavailable'}, using ${_primaryAvailable ? 'primary' : 'fallback'}`);
  return _primaryAvailable;
}

const _primaryClient = new OpenAI({ baseURL: PRIMARY_BASE_URL, apiKey: PRIMARY_API_KEY, timeout: 300000 });
const _fallbackClient = new OpenAI({ baseURL: FALLBACK_BASE_URL, apiKey: FALLBACK_API_KEY, timeout: 300000 });

// The primary is LiteLLM (since 2026-11). The old workpc-1 llama.cpp needed
// chat_template_kwargs.enable_thinking=false; LiteLLM routes need no extra body.
const PRIMARY_EXTRA_BODY = undefined;

async function getActiveConfig() {
  const usePrimary = await isPrimaryAvailable();
  return usePrimary
    ? { client: _primaryClient, model: PRIMARY_MODEL, needsSanitize: false, extraBody: PRIMARY_EXTRA_BODY }
    : { client: _fallbackClient, model: FALLBACK_MODEL, needsSanitize: true, extraBody: undefined };
}

export async function getModel() {
  const usePrimary = await isPrimaryAvailable();
  return usePrimary ? PRIMARY_MODEL : FALLBACK_MODEL;
}

/**
 * Stream a chat completion, calling onChunk for each text token.
 * Returns the full accumulated content.
 */
// CLIProxy doesn't handle non-ASCII chars reliably — sanitize all messages
function sanitize(messages) {
  return messages.map(m => ({ ...m, content: m.content.replace(/[^\x00-\x7F]/g, (c) => {
    // Replace common typographic chars with ASCII equivalents
    const map = { '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2022': '-', '\u2026': '...' };
    return map[c] || '';
  })}));
}

export async function streamChat(messages, onChunk, options = {}) {
  const active = await getActiveConfig();
  const { model = active.model, maxTokens = 2000, temperature = 0.5 } = options;

  const promptLen = messages.reduce((acc, m) => acc + m.content.length, 0);
  console.log(`[LLM] streamChat: model=${model.slice(0, 20)}… maxTokens=${maxTokens} promptChars=${promptLen}`);

  const msgs = active.needsSanitize ? sanitize(messages) : messages;
  const stream = await active.client.chat.completions.create({
    model,
    messages: msgs,
    max_tokens: maxTokens,
    temperature,
    stream: true,
    ...(active.extraBody || {}),
  });

  let fullContent = '';
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) {
      fullContent += text;
      onChunk(text);
    }
  }
  console.log(`[LLM] streamChat complete: ${fullContent.length} chars output`);
  return fullContent;
}

/**
 * Non-streaming JSON extraction — returns parsed object.
 */
export async function getJSON(systemPrompt, userMessage, options = {}) {
  const active = await getActiveConfig();
  const { model = active.model, maxTokens = 1000, metadata } = options;

  // For thinking models (Qwen3, QwQ), reasoning tokens eat into max_tokens budget.
  // Allocate extra headroom so the actual JSON output doesn't get truncated.
  const effectiveMaxTokens = Math.max(maxTokens, 10000);

  let messages = [
    { role: 'system', content: systemPrompt + '\n\nRespond with valid JSON only, no markdown code fences. Be concise.' },
    { role: 'user', content: userMessage },
  ];
  if (active.needsSanitize) messages = sanitize(messages);

  const requestBody = {
    model,
    messages,
    max_tokens: effectiveMaxTokens,
    temperature: 0,
    response_format: { type: 'json_object' },
    ...(active.extraBody || {}),
    // LiteLLM passes this on to Langfuse (trace_name, tags, trace_metadata, ...).
    ...(metadata ? { metadata } : {}),
  };

  const response = await active.client.chat.completions.create(requestBody);

  // Thinking models put reasoning in reasoning_content, actual answer in content
  const text = response.choices[0].message.content || '{}';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    // Attempt to repair truncated JSON by closing open brackets/braces
    const jsonMatch = text.match(/\{[\s\S]*/);
    if (jsonMatch) {
      let partial = jsonMatch[0];

      // Iteratively strip trailing incomplete tokens and close brackets
      for (let attempt = 0; attempt < 5; attempt++) {
        // Strip trailing incomplete string value (cut mid-string)
        // e.g. ..."body": "Cameron reached out  → strip from the unclosed quote
        let inString = false, escape = false, lastStringStart = -1;
        for (let i = 0; i < partial.length; i++) {
          if (escape) { escape = false; continue; }
          if (partial[i] === '\\') { escape = true; continue; }
          if (partial[i] === '"') {
            if (!inString) lastStringStart = i;
            inString = !inString;
          }
        }
        // If we ended inside a string, close it or strip back
        if (inString && lastStringStart >= 0) {
          // Close the unclosed string with a quote
          partial = partial + '"';
        }

        // Remove trailing incomplete key-value pairs and dangling commas
        partial = partial.replace(/,\s*"[^"]*"\s*:\s*$/, '');  // "key":
        partial = partial.replace(/,\s*"[^"]*$/, '');            // ,"incomplete
        partial = partial.replace(/,\s*$/, '');                   // trailing comma

        // Count and close open brackets/braces
        let braces = 0, brackets = 0;
        inString = false; escape = false;
        for (const ch of partial) {
          if (escape) { escape = false; continue; }
          if (ch === '\\') { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') braces++;
          if (ch === '}') braces--;
          if (ch === '[') brackets++;
          if (ch === ']') brackets--;
        }
        let closing = '';
        for (let i = 0; i < brackets; i++) closing += ']';
        for (let i = 0; i < braces; i++) closing += '}';

        try {
          const result = JSON.parse(partial + closing);
          console.warn('[LLM] Repaired truncated JSON response (attempt ' + (attempt + 1) + ')');
          return result;
        } catch {
          // Strip the last complete element and try again
          // Remove last object in an array: ...}, {incomplete} → ...}
          partial = partial.replace(/,\s*\{[^{}]*$/, '');
          // Remove last item in an array that's a string: ..."item", "inc → ..."item"
          partial = partial.replace(/,\s*"[^"]*$/, '');
        }
      }
    }
    console.error('[LLM] Failed to parse JSON:', text.slice(0, 500));
    throw new Error('LLM returned invalid JSON');
  }
}
