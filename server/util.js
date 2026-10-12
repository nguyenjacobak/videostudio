import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/** Lower-case, strip Vietnamese diacritics and punctuation — used for fuzzy word matching and cache keys. */
export function normalizeText(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

export function slugify(s = '', max = 60) {
  return normalizeText(s).replace(/\s+/g, '_').slice(0, max) || 'video';
}

export function countWords(s = '') {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

export class Semaphore {
  constructor(max) { this.max = max; this.active = 0; this.queue = []; }
  async run(fn) {
    if (this.active >= this.max) await new Promise(r => this.queue.push(r));
    this.active++;
    try { return await fn(); }
    finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/** Map with bounded concurrency; results keep input order. Errors are captured per item, never thrown. */
export async function pMap(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = { ok: true, value: await fn(items[idx], idx) }; }
      catch (error) { results[idx] = { ok: false, error }; }
    }
  });
  await Promise.all(workers);
  return results;
}

export function run(cmd, args, { input, onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
    let out = '', err = '';
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { err += d; onStderr?.(String(d)); });
    proc.on('error', reject);
    proc.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} lỗi (${code}): ${err.slice(-800)}`)));
    if (input) { proc.stdin.end(input); }
  });
}

export const ffmpeg = (args, opts) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], opts);

export async function probeDuration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d)) throw new Error(`Không đo được thời lượng: ${file}`);
  return d;
}

export function formatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function srtTime(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}
