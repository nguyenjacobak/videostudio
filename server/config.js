import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORKSPACE = path.join(ROOT, 'workspace');
export const PROJECTS_DIR = path.join(WORKSPACE, 'projects');
export const LIBRARY_DIR = path.join(WORKSPACE, 'library');
export const MUSIC_DIR = path.join(WORKSPACE, 'music');
export const RUNTIME_DIR = path.join(ROOT, 'runtime');
export const WEB_DIST = path.join(ROOT, 'web', 'dist');
export const SETTINGS_FILE = path.join(WORKSPACE, 'settings.json');

// Keys and machine-specific config live in ROOT/.env (never committed; see .env.example). Real environment variables win.
(function loadEnv(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})(path.join(ROOT, '.env'));

const env = (k, d = '') => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const envNum = (k, d) => (Number.isFinite(Number(process.env[k])) && process.env[k] !== '' && process.env[k] !== undefined ? Number(process.env[k]) : d);
const envBool = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : !/^(0|false|no|off)$/i.test(process.env[k]));

for (const dir of [WORKSPACE, PROJECTS_DIR, LIBRARY_DIR, MUSIC_DIR]) fs.mkdirSync(dir, { recursive: true });

export const PORT = Number(process.env.PORT) || 3001;

// Video canvas — the runtime and every scene prompt assume this size.
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

// Speaking rate used to budget narration length (measured on vi-VN Edge voices at rate +0%).
export const WORDS_PER_MINUTE = 175;

/** Speaking rate of the chosen voice: Edge ≈ 175 words/min, ai33/Vbee (e.g. Minh Quân) ≈ 225 (measured 2026-09-30), scaled by the rate slider. */
export function wordsPerMinute(voice) {
  const base = voice?.engine === 'ai33' ? 225 : WORDS_PER_MINUTE;
  return Math.round(base * (1 + (Number(voice?.rate) || 0) / 100));
}

// Defaults come from .env; whatever the user saves in the Settings page (workspace/settings.json) overrides them.
const DEFAULT_SETTINGS = {
  llm: {
    baseUrl: env('LLM_BASE_URL', 'https://api.xah.io/v1'),
    apiKey: env('LLM_API_KEY'),
    flashModel: env('LLM_FLASH_MODEL', 'giabaopro1908/gemini-3.8-flash-high'),
    coderModel: env('LLM_CODER_MODEL', 'gpt-6-luna'),
    visionModel: env('LLM_VISION_MODEL', 'gpt-6-luna'),
    astraModel: env('LLM_ASTRA_MODEL', 'gpt-6-astra'),
    imageModel: env('LLM_IMAGE_MODEL', 'dungcsnd113/gemini-3.1-flash-image'),
    imageConcurrency: envNum('LLM_IMAGE_CONCURRENCY', 3),
    imageBudget: env('IMAGE_BUDGET', 'auto'),     // image calls per video: 'auto' ≈ scenes/4 + 2 (3–8), or a number; each call ≈ 65 credits
    flashConcurrency: envNum('LLM_FLASH_CONCURRENCY', 6),
    coderConcurrency: envNum('LLM_CODER_CONCURRENCY', 10),
    astraConcurrency: envNum('LLM_ASTRA_CONCURRENCY', 2),
    visionReview: envBool('VISION_REVIEW', true),
  },
  tts: {
    ai33Key: env('AI33_API_KEY'),
    ai33BaseUrl: env('AI33_BASE_URL', 'https://api.ai33.pro/v3'),
  },
  render: {
    workers: envNum('RENDER_WORKERS', 4),
    crf: envNum('RENDER_CRF', 18),
    preset: env('RENDER_PRESET', 'medium'),
    browserPath: env('BROWSER_PATH'),
  },
  defaults: {
    voice: { engine: env('DEFAULT_VOICE_ENGINE', 'ai33'), voiceId: env('DEFAULT_VOICE_ID', 'vbee_hn_male_minhquan_yt-stable'), rate: envNum('DEFAULT_VOICE_RATE', 0) },
    styleId: 'cartoon',
    captions: envBool('CAPTIONS', true),
  },
};

function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

let cached = null;

export function getSettings() {
  if (cached) return cached;
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
  cached = deepMerge(DEFAULT_SETTINGS, saved);
  return cached;
}

export function saveSettings(patch) {
  const next = deepMerge(getSettings(), patch);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
  cached = next;
  return next;
}

export function findBrowser() {
  const custom = getSettings().render.browserPath;
  const candidates = [
    custom,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('Không tìm thấy Chrome/Edge. Hãy cài Chrome hoặc nhập đường dẫn trình duyệt trong Cài đặt.');
  return found;
}
