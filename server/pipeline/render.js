import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { FPS, WIDTH, HEIGHT, MUSIC_DIR, getSettings } from '../config.js';
import { openPlayer } from '../browser.js';
import { save, log, progress, projectDir, bus } from '../store.js';
import { ffmpeg, slugify, srtTime, formatTime } from '../util.js';

function splitChunks(scenes, workers) {
  const total = scenes.reduce((a, s) => a + s.duration, 0);
  const target = total / workers;
  const chunks = [];
  let cur = [], acc = 0;
  for (const s of scenes) {
    cur.push(s); acc += s.duration;
    if (acc >= target && chunks.length < workers - 1) { chunks.push(cur); cur = []; acc = 0; }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function renderChunk(p, chunk, k, totalFrames, outFile, onFrames, signal) {
  const first = chunk[0], last = chunk[chunk.length - 1];
  const f0 = Math.round(first.start * FPS);
  const f1 = Math.min(totalFrames, Math.round((last.start + last.duration) * FPS));
  const { crf, preset } = getSettings().render;
  const enc = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-g', String(FPS * 2), '-movflags', '+faststart', outFile,
  ], { windowsHide: true });
  let encErr = '';
  enc.stderr.on('data', d => { encErr += d; });
  const encDone = new Promise((res, rej) => enc.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg: ${encErr.slice(-500)}`)))));

  const h = await openPlayer({ width: WIDTH, height: HEIGHT, query: `?render=1&project=${p.id}` });
  try {
    const cdp = await h.context.newCDPSession(h.page);
    const bootErr = await h.page.evaluate(() => window.__rt.errors.filter(e => /Boot/.test(e.message)).map(e => e.message)[0]);
    if (bootErr) throw new Error(bootErr);
    let pending = 0;
    for (let f = f0; f < f1; f++) {
      if (signal?.aborted) throw new Error('Đã huỷ');
      await h.page.evaluate(t => window.__rt.seek(t), f / FPS);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true, captureBeyondViewport: false });
      const buf = Buffer.from(data, 'base64');
      if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
      if (++pending >= 15) { onFrames(pending); pending = 0; }
    }
    onFrames(pending);
    const errors = await h.page.evaluate(() => window.__rt.errors);
    if (errors.length) log(p, `Luồng ${k + 1}: ${errors.length} lỗi runtime (cảnh lỗi đã dùng mẫu an toàn): ${errors[0].message}`, 'warn');
  } finally {
    enc.stdin.end();
    await h.close();
  }
  await encDone;
}

export function buildSrt(p) {
  const cues = [];
  for (const s of p.scenes) {
    const words = s.audio?.words || [];
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      const a = s.start + cur[0].t, b = s.start + cur[cur.length - 1].t + cur[cur.length - 1].d;
      cues.push({ a, b: b + 0.2, text: cur.map(w => w.w).join(' ') });
      cur = [];
    };
    words.forEach((w, i) => {
      const prev = words[i - 1];
      if (cur.length && ((prev && w.t - (prev.t + prev.d) > 0.28) || cur.length >= 10)) flush();
      cur.push(w);
    });
    flush();
  }
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.a)} --> ${srtTime(Math.min(c.b, cues[i + 1]?.a ?? c.b))}\n${c.text}\n`).join('\n');
}

export function chapterMarkers(p) {
  const out = [];
  for (const ch of p.outline?.chapters || []) {
    const s = p.scenes.find(x => x.chapterId === ch.id);
    if (s) out.push({ t: s.start, title: ch.title });
  }
  if (out.length) out[0].t = 0;
  return out;
}

export async function runRender(p, signal) {
  const scenes = p.scenes.filter(s => s.duration > 0);
  if (!scenes.length || !p.masterAudio) throw new Error('Chưa có đủ giọng đọc để xuất video');
  const dir = projectDir(p.id, 'out');
  const tmp = projectDir(p.id, 'out', 'tmp');
  fs.mkdirSync(tmp, { recursive: true });

  const duration = scenes.reduce((a, s) => Math.max(a, s.start + s.duration), 0);
  const totalFrames = Math.ceil(duration * FPS);
  const workers = Math.max(1, Math.min(getSettings().render.workers, scenes.length));
  const chunks = splitChunks(scenes, workers);
  const t0 = Date.now();
  let framesDone = 0;
  log(p, `Bắt đầu xuất ${formatTime(duration)} video (${totalFrames} khung hình, ${chunks.length} luồng song song)...`);
  progress(p, 'render', 0, totalFrames, 'Đang dựng khung hình');

  const segFiles = chunks.map((_, k) => path.join(tmp, `seg_${k}.mp4`));
  const onFrames = n => {
    framesDone += n;
    const el = (Date.now() - t0) / 1000;
    const eta = framesDone ? (el / framesDone) * (totalFrames - framesDone) : 0;
    progress(p, 'render', framesDone, totalFrames, `Khung ${framesDone}/${totalFrames} · còn ~${formatTime(eta)}`);
  };
  const ac = new AbortController();
  const sig = signal ? AbortSignal.any([signal, ac.signal]) : ac.signal;
  try {
    await Promise.all(chunks.map((c, k) => renderChunk(p, c, k, totalFrames, segFiles[k], onFrames, sig).catch(e => { ac.abort(); throw e; })));
  } catch (err) {
    throw new Error(`Render lỗi: ${err.message}`);
  }

  progress(p, 'render', totalFrames, totalFrames, 'Ghép video + âm thanh');
  const listFile = path.join(tmp, 'segments.txt');
  fs.writeFileSync(listFile, segFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const silent = path.join(tmp, 'video.mp4');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent]);

  const name = `${slugify(p.title, 50)}.mp4`;
  const outFile = path.join(dir, name);
  const master = projectDir(p.id, p.masterAudio.file);
  const music = p.settings.music ? path.join(MUSIC_DIR, p.settings.music) : null;
  if (music && fs.existsSync(music)) {
    const vol = Number(p.settings.musicVolume) || 0.12;
    await ffmpeg([
      '-i', silent, '-i', master, '-stream_loop', '-1', '-i', music,
      '-filter_complex', `[2:a]volume=${vol},afade=t=in:d=2[m];[1:a]asplit=2[v1][v2];[m][v1]sidechaincompress=threshold=0.04:ratio=6:attack=30:release=500[duck];[v2][duck]amix=inputs=2:duration=first:normalize=0,afade=t=out:st=${Math.max(0, duration - 2.5)}:d=2.5[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), '-movflags', '+faststart', outFile,
    ]);
  } else {
    await ffmpeg(['-i', silent, '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-t', String(duration), '-movflags', '+faststart', outFile]);
  }
  fs.writeFileSync(path.join(dir, 'subtitles.srt'), buildSrt(p));
  fs.rmSync(tmp, { recursive: true, force: true });

  const size = fs.statSync(outFile).size;
  p.render = { file: `out/${name}`, srt: 'out/subtitles.srt', duration, size, at: Date.now(), took: Math.round((Date.now() - t0) / 1000) };
  log(p, `✅ Xuất xong: ${name} (${(size / 1048576).toFixed(1)} MB, mất ${formatTime(p.render.took)}).`);
  save(p);
  bus.emit('rendered', p.id);
}
