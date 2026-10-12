import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { PROJECTS_DIR, getSettings } from './config.js';
import { uid, writeJsonAtomic, readJson } from './util.js';

// In-memory projects are the source of truth while the server runs; every mutation is persisted via save().
const cache = new Map();
export const bus = new EventEmitter();
bus.setMaxListeners(100);

export const STAGES = ['script', 'voice', 'art', 'scenes', 'render'];

export function projectDir(id, ...sub) {
  return path.join(PROJECTS_DIR, id, ...sub);
}

export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR)
    .map(id => { try { return getProject(id); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id) {
  if (cache.has(id)) return cache.get(id);
  const p = readJson(projectDir(id, 'project.json'));
  if (!p) throw Object.assign(new Error('Không tìm thấy dự án'), { status: 404 });
  // A server restart kills any job that was running.
  for (const st of Object.values(p.stages || {})) if (st.state === 'running') { st.state = 'error'; st.error = 'Bị gián đoạn (máy chủ khởi động lại) — bấm Tiếp tục'; }
  if (p.status === 'running') p.status = 'error';
  cache.set(id, p);
  return p;
}

export function save(p) {
  p.updatedAt = Date.now();
  writeJsonAtomic(projectDir(p.id, 'project.json'), p);
  bus.emit('project', p.id);
}

const firstLine = s => String(s || '').split('\n').map(l => l.replace(/^[#*\s]+/, '').trim()).find(Boolean) || '';

export function createProject(input) {
  const d = getSettings().defaults;
  const id = uid('p_');
  const p = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: (input.topic || firstLine(input.script))?.slice(0, 80) || 'Video mới',
    brief: {
      topic: input.topic || '',
      // Pasted script (used verbatim as narration). Length is never chosen by the user: it follows the script,
      // or the AI sizes it to the topic at outline time (then `minutes` is filled in).
      script: String(input.script || '').trim(),
      category: input.category || 'science',
      minutes: Number(input.minutes) > 0 ? Math.min(20, Math.max(1, Number(input.minutes))) : null, // only set through the API (demos); the UI lets the content decide
      audience: input.audience || 'Người xem phổ thông, tò mò, muốn hiểu bản chất',
      tone: input.tone || 'story',
      notes: input.notes || '',
      sources: input.sources || '',
    },
    settings: {
      styleId: 'cartoon',
      voice: { ...d.voice, ...(input.voice || {}) },
      captions: input.captions ?? d.captions,
      mode: input.mode || 'auto',
      music: input.music || '',
      musicVolume: 0.12,
    },
    status: 'draft',
    stages: Object.fromEntries(STAGES.map(s => [s, { state: 'pending' }])),
    outline: null,
    scenes: [],
    style: null,
    assets: [],
    cost: { flash: emptyCost(), astra: emptyCost() },
    render: null,
    publish: null,
  };
  fs.mkdirSync(projectDir(id), { recursive: true });
  cache.set(id, p);
  save(p);
  return p;
}

function emptyCost() { return { calls: 0, tokensIn: 0, tokensOut: 0, credits: 0 }; }

export function deleteProject(id) {
  cache.delete(id);
  fs.rmSync(projectDir(id), { recursive: true, force: true });
}

export function usageRecorder(p) {
  return (role, u) => {
    const c = p.cost[role] ||= emptyCost();
    c.calls++; c.tokensIn += u.tokensIn; c.tokensOut += u.tokensOut; c.credits += u.credits;
  };
}

export function log(p, message, level = 'info') {
  const entry = { t: Date.now(), level, message };
  fs.appendFile(projectDir(p.id, 'log.jsonl'), JSON.stringify(entry) + '\n', () => {});
  bus.emit('log', p.id, entry);
  if (level === 'error') console.error(`[${p.id}] ${message}`); else console.log(`[${p.id}] ${message}`);
}

export function readLog(id, limit = 300) {
  try {
    const lines = fs.readFileSync(projectDir(id, 'log.jsonl'), 'utf8').trim().split('\n');
    return lines.slice(-limit).map(l => JSON.parse(l));
  } catch { return []; }
}

export function progress(p, stage, done, total, label = '') {
  p.stages[stage].progress = { done, total, label };
  bus.emit('progress', p.id, { stage, done, total, label });
}

/** Recompute each scene's start time on the master timeline from its audio duration. */
export function retime(p) {
  let t = 0;
  for (const s of p.scenes) {
    s.start = Math.round(t * 1000) / 1000;
    t += s.duration || 0;
  }
  return t;
}

export function totalDuration(p) {
  return p.scenes.reduce((a, s) => a + (s.duration || 0), 0);
}
