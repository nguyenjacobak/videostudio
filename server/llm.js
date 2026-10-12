import { getSettings } from './config.js';
import { Semaphore, sleep } from './util.js';

// Roles → models (all configurable in Settings):
//  - flash:  cheap & fast. Outline, script, editor pass, YouTube metadata.
//  - coder:  writes every scene's HTML/CSS/GSAP and its repairs (default gpt-6-luna).
//  - vision: looks at rendered frames and critiques them (needs a model that really reads images).
//  - astra:  expensive. Only art direction, hero illustrations and (premium tier) the hook scenes.
//  - image:  image model (≈65 credits/call) — sprite sheets and backgrounds for the motion-graphics style.
export function modelFor(role) {
  const s = getSettings().llm;
  return { astra: s.astraModel, coder: s.coderModel || s.flashModel, vision: s.visionModel || s.coderModel || s.flashModel, image: s.imageModel || 'dungcsnd113/gemini-3.1-flash-image' }[role] || s.flashModel;
}

const semaphores = {};
function semaphoreFor(role) {
  const s = getSettings().llm;
  const max = role === 'image' ? (s.imageConcurrency || 3) : role === 'astra' ? s.astraConcurrency : role === 'coder' || role === 'vision' ? (s.coderConcurrency || s.flashConcurrency) : s.flashConcurrency;
  if (!semaphores[role] || semaphores[role].max !== max) semaphores[role] = new Semaphore(max);
  return semaphores[role];
}

export class LLMError extends Error {
  constructor(message, { status, fatal } = {}) { super(message); this.status = status; this.fatal = fatal; }
}

/**
 * @param {object} o
 * @param {'flash'|'coder'|'vision'|'astra'} o.role
 * @param {Array} o.messages
 * @param {(role:string, usage:object)=>void} [o.onUsage] cost accounting hook
 */
export async function chat({ role = 'flash', messages, temperature = 0.7, maxTokens = 8000, onUsage, signal, retries = 5 }) {
  const s = getSettings().llm;
  const model = modelFor(role);
  const timeoutMs = role === 'flash' ? 240000 : role === 'image' ? 300000 : 480000;

  return semaphoreFor(role).run(async () => {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (signal?.aborted) throw new LLMError('Đã huỷ', { fatal: true });
      const started = Date.now();
      try {
        const res = await fetch(`${s.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${s.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        });
        const text = await res.text();
        if (!res.ok) {
          // 404 from this proxy is sometimes a transient 'upstream not found' — retry it.
          const fatal = [400, 401, 402, 403].includes(res.status);
          let msg = text.slice(0, 400);
          try { msg = JSON.parse(text).error?.message || msg; } catch {}
          throw new LLMError(`${model} lỗi ${res.status}: ${msg}`, { status: res.status, fatal });
        }
        const data = JSON.parse(text);
        const choice = data.choices?.[0];
        const content = choice?.message?.content || choice?.message?.reasoning_content || '';
        const usage = data.usage || {};
        onUsage?.(role, {
          tokensIn: usage.prompt_tokens || 0,
          tokensOut: usage.completion_tokens || 0,
          credits: usage.x_ckey?.cost || 0,
          ms: Date.now() - started,
        });
        if (!content.trim()) throw new LLMError('Phản hồi rỗng');
        return { content, truncated: choice?.finish_reason === 'length' };
      } catch (err) {
        lastErr = err;
        if (err.fatal || signal?.aborted) throw err;
        // back off: 3s, 8s, 20s, 45s — rate limits and upstream hiccups usually clear within a minute
        if (attempt < retries) await sleep([3000, 8000, 20000, 45000][attempt - 1] || 45000);
      }
    }
    throw lastErr;
  });
}

/** Parse JSON out of an LLM reply (tolerates code fences, prose around it and trailing commas). */
export function parseJson(raw) {
  let text = String(raw).replace(/```(?:json)?/gi, '').trim();
  const start = text.search(/[\[{]/);
  if (start < 0) throw new Error('Không tìm thấy JSON trong phản hồi');
  const open = text[start], close = open === '{' ? '}' : ']';
  const end = text.lastIndexOf(close);
  text = text.slice(start, end + 1);
  try { return JSON.parse(text); } catch {}
  const repaired = text.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
  return JSON.parse(repaired);
}

/** chat() + parseJson() with one corrective retry when the reply isn't valid JSON. */
export async function chatJson(opts) {
  const first = await chat(opts);
  try { return parseJson(first.content); }
  catch (e) {
    const second = await chat({
      ...opts,
      temperature: 0.2,
      messages: [
        ...opts.messages,
        { role: 'assistant', content: first.content.slice(0, 12000) },
        { role: 'user', content: `Phản hồi trên không phải JSON hợp lệ (${e.message}${first.truncated ? ', bị cắt cụt vì quá dài' : ''}). Trả lại DUY NHẤT một JSON hợp lệ, đầy đủ, ngắn gọn hơn nếu cần. Không kèm giải thích.` },
      ],
    });
    return parseJson(second.content);
  }
}

/** Extract ```html / ```css / ```js fenced blocks from a scene-code reply. */
export function extractCodeBlocks(raw) {
  const blocks = {};
  const re = /```(html|css|js|javascript)\s*\n([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(raw))) {
    const lang = m[1].toLowerCase() === 'javascript' ? 'js' : m[1].toLowerCase();
    blocks[lang] = (blocks[lang] ? blocks[lang] + '\n' : '') + m[2].trim();
  }
  return blocks;
}
