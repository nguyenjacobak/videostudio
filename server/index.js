import fs from 'fs';
import path from 'path';
import express from 'express';
import { ROOT, RUNTIME_DIR, WEB_DIST, PROJECTS_DIR, MUSIC_DIR, LIBRARY_DIR, PORT, WORDS_PER_MINUTE, wordsPerMinute, getSettings, saveSettings } from './config.js';
import { STYLES, CATEGORIES, TONES } from './styles.js';
import { listProjects, getProject, createProject, deleteProject, save, bus, readLog, log, STAGES } from './store.js';
import { startPipeline, startRender, cancelJob, isBusy, jobLabel, runJob } from './pipeline/index.js';
import { EDGE_VOICES, listAi33Voices, previewVoice, revoiceScene, voiceKey } from './pipeline/voice.js';
import { generateScene, codeKey, ensureCast } from './pipeline/scenes.js';
import { runPublish } from './pipeline/publish.js';
import { makeScene } from './pipeline/script.js';
import { buildRuntimeData } from './runtimeData.js';
import { inspectScene, closeBrowser } from './browser.js';
import { countWords, writeJsonAtomic } from './util.js';
import { listLibrary, BLOCKED } from './pipeline/art.js';
import { listCast, saveCastList } from './castLibrary.js';
import { listImageLibrary } from './pipeline/images.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

const nm = p => path.join(ROOT, 'node_modules', p);
const vendor = {
  gsap: nm('gsap/dist'), d3: nm('d3/dist'), topojson: nm('topojson-client/dist'), rough: nm('roughjs/bundled'),
  lucide: nm('lucide/dist/umd'), katex: nm('katex/dist'), world: nm('world-atlas'),
  'fonts/be-vietnam-pro': nm('@fontsource/be-vietnam-pro'), 'fonts/patrick-hand': nm('@fontsource/patrick-hand'),
  'fonts/inter': nm('@fontsource-variable/inter'), 'fonts/montserrat': nm('@fontsource-variable/montserrat'),
  'fonts/playfair-display': nm('@fontsource-variable/playfair-display'), 'fonts/lora': nm('@fontsource-variable/lora'),
  'fonts/oswald': nm('@fontsource-variable/oswald'), 'fonts/jetbrains-mono': nm('@fontsource-variable/jetbrains-mono'),
};
for (const [route, dir] of Object.entries(vendor)) app.use(`/vendor/${route}`, express.static(dir, { maxAge: '7d' }));
app.use('/runtime', express.static(RUNTIME_DIR, { etag: false, maxAge: 0 }));
app.use('/files', express.static(PROJECTS_DIR, { dotfiles: 'deny' }));
app.use('/library-files', express.static(LIBRARY_DIR, { dotfiles: 'deny' }));

// Library: Astra drawings and cartoon characters kept from earlier videos (reused automatically by later ones).
app.get('/api/library', (req, res) => {
  const lib = listLibrary();
  res.json({
    assets: Object.entries(lib).map(([key, e]) => ({ key, id: e.id, name: e.name, description: e.description, style: e.style, uses: e.uses || 0, reusable: e.review?.ok !== false && !BLOCKED.test(`${e.id} ${e.name}`), reviewIssues: e.review?.ok === false ? e.review.issues : null, createdAt: e.createdAt, url: `/library-files/${encodeURIComponent(e.file)}` }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    cast: listCast(),
    images: Object.values(listImageLibrary()).map(e => ({ key: e.key, name: e.name, kind: e.kind, uses: e.uses || 0, createdAt: e.createdAt, url: `/library-files/images/${encodeURIComponent(e.file)}` })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  });
});
app.delete('/api/library/images/:key', (req, res) => {
  const lib = listImageLibrary(), e = lib[req.params.key];
  if (!e) return res.status(404).json({ error: 'Không tìm thấy hình' });
  delete lib[req.params.key];
  writeJsonAtomic(path.join(LIBRARY_DIR, 'images', 'index.json'), lib);
  try { fs.unlinkSync(path.join(LIBRARY_DIR, 'images', e.file)); } catch {}
  res.json({ ok: true });
});
app.delete('/api/library/assets/:key', (req, res) => {
  const lib = listLibrary(), e = lib[req.params.key];
  if (!e) return res.status(404).json({ error: 'Không tìm thấy hình' });
  delete lib[req.params.key];
  writeJsonAtomic(path.join(LIBRARY_DIR, 'index.json'), lib);
  try { fs.unlinkSync(path.join(LIBRARY_DIR, e.file)); } catch {}
  res.json({ ok: true });
});
app.delete('/api/library/cast/:id', (req, res) => {
  saveCastList(listCast().filter(c => c.id !== req.params.id));
  res.json({ ok: true });
});

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
};

// ---------- project views ----------
function summary(p) {
  return {
    id: p.id, title: p.title, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt,
    minutes: p.outline?.minutes || p.brief.minutes || null, category: p.brief.category, styleId: p.settings.styleId,
    scenes: p.scenes.length, duration: p.masterAudio?.duration || 0, busy: jobLabel(p.id),
    thumb: p.scenes.find(s => s.thumb)?.thumb ? `/files/${p.id}/${p.scenes.find(s => s.thumb).thumb}` : null,
    stages: Object.fromEntries(STAGES.map(s => [s, p.stages[s]?.state])), rendered: !!p.render,
  };
}

// The concatenated narration no longer matches the scene list (scene deleted/re-voiced).
const masterStale = p => !!p.masterAudio && p.masterAudio.sig !== p.scenes.map(s => s.audio?.key).join('');

function view(p) {
  const voice = p.settings.voice;
  return {
    ...p,
    busy: jobLabel(p.id),
    wordCount: p.scenes.reduce((a, s) => a + countWords(s.narration), 0),
    wordsPerMinute: wordsPerMinute(p.settings.voice),
    masterStale: masterStale(p),
    scenes: p.scenes.map((s, i) => ({
      id: s.id, chapterId: s.chapterId, chapterTitle: s.chapterTitle, narration: s.narration, visualType: s.visualType, visual: s.visual,
      onScreenText: s.onScreenText, data: s.data, setting: s.setting || null, env: s.env || null, shot: s.shot || null, time: s.time || null, form: s.form || null, items: s.items || [], transition: s.transition || null, characters: s.characters || [], start: s.start, duration: s.duration,
      isChapterStart: i === 0 || p.scenes[i - 1].chapterId !== s.chapterId,
      thumb: s.thumb ? `/files/${p.id}/${s.thumb}` : null,
      voiced: !!s.audio && s.audio.key === voiceKey(s, voice),
      coded: !!s.code && s.code.key === codeKey(s),
      codeBy: s.code?.by || null, codeModel: s.code?.model || null, issues: s.code?.issues || [],
    })),
  };
}

app.get('/api/meta', wrap(async (req, res) => {
  const music = fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|m4a|wav|ogg|aac)$/i.test(f));
  res.json({
    styles: Object.fromEntries(Object.entries(STYLES).map(([id, s]) => [id, { name: s.name, desc: s.desc, tokens: s.tokens }])),
    categories: CATEGORIES, tones: TONES,
    voices: [...EDGE_VOICES, ...(await listAi33Voices())],
    music, wordsPerMinute: WORDS_PER_MINUTE,
  });
}));

app.get('/api/settings', (req, res) => res.json(getSettings()));
app.put('/api/settings', wrap(async (req, res) => { const s = saveSettings(req.body || {}); await closeBrowser(); res.json(s); }));

app.get('/api/voices/preview', wrap(async (req, res) => {
  const file = await previewVoice({ engine: req.query.engine || 'edge', voiceId: req.query.voiceId, rate: Number(req.query.rate) || 0 });
  res.sendFile(file);
}));

app.post('/api/music', express.raw({ type: '*/*', limit: '60mb' }), wrap(async (req, res) => {
  const name = String(req.headers['x-filename'] || `music_${Date.now()}.mp3`).replace(/[^\w.\- ]/g, '_');
  fs.writeFileSync(path.join(MUSIC_DIR, name), req.body);
  res.json({ ok: true, name });
}));

app.get('/api/projects', (req, res) => res.json(listProjects().map(summary)));

app.post('/api/projects', wrap(async (req, res) => {
  const b = req.body || {};
  if (!String(b.topic || '').trim() && String(b.script || '').trim().split(/\s+/).length < 30) return res.status(400).json({ error: 'Hãy nhập chủ đề, hoặc dán kịch bản (ít nhất vài câu)' });
  const p = createProject(b);
  startPipeline(p);
  res.json(view(p));
}));

app.get('/api/projects/:id', wrap(async (req, res) => res.json(view(getProject(req.params.id)))));

app.patch('/api/projects/:id', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  const { title, settings, brief } = req.body || {};
  if (title) p.title = String(title).slice(0, 120);
  if (brief) Object.assign(p.brief, brief);
  if (settings) {
    const styleChanged = settings.styleId && settings.styleId !== p.settings.styleId;
    p.settings = { ...p.settings, ...settings, voice: { ...p.settings.voice, ...(settings.voice || {}) } };
    if (styleChanged) {
      // New look: re-run art direction and rebuild every scene on next run.
      p.style = null; p.assets = [];
      p.stages.art.state = 'pending'; p.stages.scenes.state = 'pending';
      p.scenes.forEach(s => { if (s.code) s.code.key = 'restyle'; });
    }
  }
  save(p);
  res.json(view(p));
}));

app.delete('/api/projects/:id', wrap(async (req, res) => {
  cancelJob(req.params.id);
  deleteProject(req.params.id);
  res.json({ ok: true });
}));

app.post('/api/projects/:id/run', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  startPipeline(p, { render: req.body?.render });
  res.json(view(p));
}));

app.post('/api/projects/:id/approve', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  p.scriptApproved = true;
  save(p);
  startPipeline(p);
  res.json(view(p));
}));

app.post('/api/projects/:id/rewrite', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (isBusy(p.id)) return res.status(409).json({ error: 'Dự án đang bận' });
  Object.assign(p.brief, req.body?.brief || {});
  p.outline = null; p.scenes = []; p.masterAudio = null; p.publish = null; p.render = null; p.scriptApproved = false;
  for (const s of STAGES) p.stages[s] = { state: 'pending' };
  save(p);
  startPipeline(p);
  res.json(view(p));
}));

app.post('/api/projects/:id/cancel', (req, res) => res.json({ ok: cancelJob(req.params.id) }));

app.post('/api/projects/:id/render', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  const stale = p.scenes.filter(s => !s.code || s.code.key !== codeKey(s) || !s.audio || s.audio.key !== voiceKey(s, p.settings.voice));
  if (stale.length || masterStale(p)) startPipeline(p, { render: true });
  else startRender(p);
  res.json(view(p));
}));

app.post('/api/projects/:id/publish', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  runJob(p, 'Tạo metadata YouTube', signal => runPublish(p, signal));
  res.json({ ok: true });
}));

app.get('/api/projects/:id/runtime', wrap(async (req, res) => {
  res.json(buildRuntimeData(getProject(req.params.id), { sceneId: req.query.scene }));
}));

app.get('/api/projects/:id/log', (req, res) => res.json(readLog(req.params.id)));

// ---------- scenes ----------
function findScene(p, sid) {
  const i = p.scenes.findIndex(s => s.id === sid);
  if (i < 0) throw Object.assign(new Error('Không tìm thấy cảnh'), { status: 404 });
  return [p.scenes[i], i];
}

app.get('/api/projects/:id/scenes/:sid', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  const [s] = findScene(p, req.params.sid);
  res.json(s);
}));

app.patch('/api/projects/:id/scenes/:sid', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  const [s] = findScene(p, req.params.sid);
  for (const k of ['narration', 'visual', 'visualType', 'onScreenText']) if (typeof req.body[k] === 'string') s[k] = req.body[k].trim();
  save(p);
  res.json(view(p));
}));

app.post('/api/projects/:id/scenes', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (isBusy(p.id)) return res.status(409).json({ error: 'Dự án đang bận' });
  const after = Math.min(p.scenes.length - 1, Number(req.body.afterIndex ?? p.scenes.length - 1));
  const ref = p.scenes[after] || p.scenes[0];
  const ch = p.outline.chapters.find(c => c.id === ref.chapterId);
  const s = makeScene(ch, { narration: req.body.narration || 'Lời thoại mới.', visual: req.body.visual || '', visualType: req.body.visualType || 'illustration' });
  p.scenes.splice(after + 1, 0, s);
  save(p);
  res.json(view(p));
}));

app.delete('/api/projects/:id/scenes/:sid', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (isBusy(p.id)) return res.status(409).json({ error: 'Dự án đang bận' });
  const [, i] = findScene(p, req.params.sid);
  p.scenes.splice(i, 1);
  save(p);
  res.json(view(p));
}));

app.post('/api/projects/:id/scenes/:sid/regenerate', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  const [s, i] = findScene(p, req.params.sid);
  const { instruction } = req.body || {};
  runJob(p, `Làm lại cảnh ${i + 1}`, async signal => {
    if (instruction) s.instruction = String(instruction).slice(0, 1500);
    if (!s.audio || s.audio.key !== voiceKey(s, p.settings.voice)) await revoiceScene(p, s);
    await ensureCast(p, signal);
    log(p, `Làm lại cảnh ${i + 1}${instruction ? ` — yêu cầu: ${instruction}` : ''}...`);
    const code = await generateScene(p, i, { signal });
    log(p, `Cảnh ${i + 1} đã dựng lại (${code.by}${code.issues.length ? `, còn ${code.issues.length} lưu ý` : ''}).`);
    save(p);
  });
  res.json({ ok: true });
}));

app.post('/api/projects/:id/scenes/:sid/revoice', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  const [s, i] = findScene(p, req.params.sid);
  runJob(p, `Đọc lại cảnh ${i + 1}`, async () => { await revoiceScene(p, s); log(p, `Đã đọc lại cảnh ${i + 1}.`); });
  res.json({ ok: true });
}));

app.put('/api/projects/:id/scenes/:sid/code', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  const [s] = findScene(p, req.params.sid);
  const code = { html: req.body.html || '', css: req.body.css || '', js: req.body.js || '' };
  const qa = s.audio ? await inspectScene(buildRuntimeData(p, { sceneId: s.id, code })) : { errors: [], issues: [], warnings: [] };
  s.code = { ...code, by: 'manual', key: codeKey(s), issues: [...qa.errors.map(e => `Lỗi JS: ${e.message}`), ...qa.issues, ...qa.warnings], at: Date.now() };
  if (qa.thumb) {
    fs.mkdirSync(path.join(PROJECTS_DIR, p.id, 'thumbs'), { recursive: true });
    fs.writeFileSync(path.join(PROJECTS_DIR, p.id, 'thumbs', `${s.id}.jpg`), qa.thumb);
    s.thumb = `thumbs/${s.id}.jpg?v=${Date.now()}`;
  }
  save(p);
  res.json({ issues: s.code.issues });
}));

// ---------- live events ----------
app.get('/api/projects/:id/events', (req, res) => {
  const id = req.params.id;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const onProject = pid => pid === id && send('changed', {});
  const onLog = (pid, e) => pid === id && send('log', e);
  const onProgress = (pid, e) => pid === id && send('progress', e);
  const onJob = (pid, label) => pid === id && send('job', { label });
  bus.on('project', onProject); bus.on('log', onLog); bus.on('progress', onProgress); bus.on('job', onJob);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(ping);
    bus.off('project', onProject); bus.off('log', onLog); bus.off('progress', onProgress); bus.off('job', onJob);
  });
});

// ---------- web app ----------
app.use(express.static(WEB_DIST));
app.get(/^\/(?!api|files|runtime|vendor).*/, (req, res) => {
  const index = path.join(WEB_DIST, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.send('Chưa build giao diện. Chạy: npm run build');
});

// A long-running local tool should survive a stray library error rather than kill every job.
process.on('uncaughtException', err => console.error('[uncaught]', err));
process.on('unhandledRejection', err => console.error('[unhandled]', err));

app.listen(PORT, () => {
  console.log(`\n  Video Studio đang chạy tại  http://localhost:${PORT}\n`);
});
