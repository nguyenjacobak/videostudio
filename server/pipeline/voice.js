import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { getSettings, WORKSPACE } from '../config.js';
import { ffmpeg, probeDuration, sleep, pMap, countWords, Semaphore } from '../util.js';

// ai33 queues requests server-side; more than ~3 at once (across all projects) makes tasks time out.
const ai33Gate = new Semaphore(3);
import { projectDir, save, log, progress, retime } from '../store.js';

export const EDGE_VOICES = [
  { id: 'vi-VN-NamMinhNeural', engine: 'edge', name: 'Nam Minh', gender: 'Nam', note: 'Giọng nam miền Bắc, trầm, rõ — hợp phim tài liệu' },
  { id: 'vi-VN-HoaiMyNeural', engine: 'edge', name: 'Hoài My', gender: 'Nữ', note: 'Giọng nữ miền Bắc, sáng, truyền cảm' },
];

const PAD_AFTER = 0.35;        // silence after each scene's narration
const PAD_CHAPTER_END = 0.6;   // extra breath at the end of a chapter

export function voiceKey(scene, voice) {
  return crypto.createHash('md5').update(`${voice.engine}|${voice.voiceId}|${voice.rate}|${scene.narration}`).digest('hex').slice(0, 12);
}

// ---------------- Edge ----------------
// Streams are consumed directly (the library's toFile() crashes the process when metadata is empty).
function edgeOnce(text, voice) {
  return new Promise(async (resolve, reject) => {
    const tts = new MsEdgeTTS();
    const timer = setTimeout(() => { try { tts.close(); } catch {} reject(new Error('Edge TTS quá thời gian')); }, 45000);
    try {
      await tts.setMetadata(voice.voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
      const rate = Number(voice.rate) || 0;
      const { audioStream, metadataStream } = tts.toStream(text, { rate: `${rate >= 0 ? '+' : ''}${rate}%` });
      const chunks = [], meta = [];
      const audioDone = new Promise((res, rej) => {
        audioStream.on('data', c => chunks.push(c));
        audioStream.once('end', res); audioStream.once('close', res); audioStream.once('error', rej);
      });
      const metaDone = new Promise(res => {
        if (!metadataStream) return res();
        metadataStream.on('data', c => { try { meta.push(...(JSON.parse(c.toString()).Metadata || [])); } catch {} });
        metadataStream.once('end', res); metadataStream.once('close', res); metadataStream.once('error', res);
      });
      await audioDone;
      await Promise.race([metaDone, sleep(3000)]);
      const audio = Buffer.concat(chunks);
      if (audio.length < 1000) throw new Error('Edge TTS không trả âm thanh');
      const words = meta.filter(m => m.Type === 'WordBoundary').map(m => ({
        w: m.Data.text.Text,
        t: Math.round(m.Data.Offset / 1e4) / 1000,
        d: Math.round(m.Data.Duration / 1e4) / 1000,
      }));
      resolve({ audio, words });
    } catch (err) {
      reject(err);
    } finally {
      clearTimeout(timer);
      try { tts.close(); } catch {}
    }
  });
}

async function synthEdge(text, voice, outFile) {
  let lastErr;
  for (let attempt = 1; attempt <= 7; attempt++) {
    try {
      const { audio, words } = await edgeOnce(text, voice);
      fs.writeFileSync(outFile, audio);
      return words;
    } catch (err) {
      lastErr = err;
      await sleep(2000 * attempt);
    }
  }
  throw new Error(`Edge TTS lỗi: ${lastErr?.message || lastErr}`);
}

/** Even word timings across the speech when the engine gave none. */
function estimateWords(text, duration) {
  const toks = text.split(/\s+/).map(t => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, '')).filter(Boolean);
  const step = (duration - 0.2) / Math.max(1, toks.length);
  return toks.map((w, i) => ({ w, t: Math.round((0.1 + i * step) * 1000) / 1000, d: Math.round(step * 0.85 * 1000) / 1000 }));
}

// ---------------- ai33.pro (Vbee / ElevenLabs / Minimax voices) ----------------
function parseSrt(srt) {
  const toSec = s => { const [h, m, rest] = s.split(':'); const [sec, ms] = rest.split(/[,.]/); return +h * 3600 + +m * 60 + +sec + +ms / 1000; };
  return srt.replace(/\r/g, '').split(/\n\n+/).map(block => {
    const lines = block.split('\n').filter(Boolean);
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) return null;
    const [a, b] = timeLine.split('-->').map(x => x.trim());
    return { start: toSec(a), end: toSec(b), text: lines.slice(lines.indexOf(timeLine) + 1).join(' ') };
  }).filter(Boolean);
}

/** Spread each SRT cue's duration over its words, weighted by word length. */
function wordsFromCues(cues) {
  const words = [];
  for (const c of cues) {
    const toks = c.text.split(/\s+/).filter(Boolean);
    const weights = toks.map(t => 1 + t.replace(/[^\p{L}\p{N}]/gu, '').length * 0.35);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let t = c.start;
    toks.forEach((tok, i) => {
      const d = ((c.end - c.start) * weights[i]) / total;
      const w = tok.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, '');
      if (w) words.push({ w, t: Math.round(t * 1000) / 1000, d: Math.round(d * 0.9 * 1000) / 1000 });
      t += d;
    });
  }
  return words;
}

async function synthAi33Once(text, voice, outFile) {
  const { ai33Key, ai33BaseUrl } = getSettings().tts;
  if (!ai33Key) throw new Error('Chưa nhập API key ai33.pro trong Cài đặt');
  const headers = { 'xi-api-key': ai33Key.trim(), 'Content-Type': 'application/json' };
  const res = await fetch(`${ai33BaseUrl}/text-to-speech`, {
    method: 'POST', headers,
    body: JSON.stringify({ text, voice_id: voice.voiceId, speed: 1 + (Number(voice.rate) || 0) / 100, with_transcript: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success || !data.task_id) throw new Error(`ai33: ${data.message || res.status}`);
  let audioUrl, srtUrl;
  for (let i = 0; i < 150; i++) {
    await sleep(2000);
    const poll = await fetch(`${ai33BaseUrl}/task/${data.task_id}`, { headers }).then(r => r.json()).catch(() => ({}));
    const md = poll.data?.metadata || {};
    if (poll.data?.status === 'error' || poll.data?.status === 'failed') throw new Error(`ai33: tác vụ thất bại`);
    if (poll.data?.status === 'done' && md.audio_url) { audioUrl = md.audio_url; srtUrl = md.srt_url; break; }
  }
  if (!audioUrl) throw new Error('ai33: hết thời gian chờ');
  fs.writeFileSync(outFile, Buffer.from(await (await fetch(audioUrl)).arrayBuffer()));
  const duration = await probeDuration(outFile);
  let cues = [];
  if (srtUrl) { try { cues = parseSrt(await (await fetch(srtUrl)).text()); } catch {} }
  if (!cues.length) cues = [{ start: 0.05, end: duration - 0.1, text }];
  return wordsFromCues(cues);
}

export async function listAi33Voices() {
  const { ai33Key, ai33BaseUrl } = getSettings().tts;
  if (!ai33Key) return [];
  try {
    const res = await fetch(`${ai33BaseUrl}/voices?provider=vbee`, { headers: { 'xi-api-key': ai33Key.trim() }, signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    const list = data.voices || data.data || [];
    return list.filter(v => /vi|viet/i.test(`${v.language || ''} ${v.voice_id || ''} ${v.labels?.language || ''}`) || String(v.voice_id).startsWith('vbee'))
      .slice(0, 60)
      .map(v => ({ id: v.voice_id, engine: 'ai33', name: v.name || v.voice_id, gender: v.labels?.gender || v.gender || '', note: 'ai33.pro (trả phí theo ký tự)' }));
  } catch { return []; }
}

async function synthAi33(text, voice, outFile) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await ai33Gate.run(() => synthAi33Once(text, voice, outFile)); }
    catch (err) {
      lastErr = err;
      if (/key|API key|401|403|số dư|balance|credit/i.test(err.message)) throw err;
      await sleep(4000 * attempt);
    }
  }
  throw lastErr;
}

export async function synthesize(text, voice, outFile) {
  return voice.engine === 'ai33' ? synthAi33(text, voice, outFile) : synthEdge(text, voice, outFile);
}

/** Cached voice sample for the voice picker. */
export async function previewVoice(voice) {
  const dir = path.join(WORKSPACE, 'cache', 'voice-preview');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${voice.engine}_${voice.voiceId}_${voice.rate || 0}.mp3`.replace(/[^\w.-]/g, '_'));
  if (!fs.existsSync(file)) await synthesize('Xin chào! Hôm nay chúng ta sẽ cùng tìm hiểu vì sao lạm phát lại khiến đồng tiền trong túi bạn mất giá theo thời gian.', voice, file);
  return file;
}

// ---------------- stage ----------------
async function voiceScene(p, scene) {
  const voice = p.settings.voice;
  const key = voiceKey(scene, voice);
  const mp3 = projectDir(p.id, 'audio', `${scene.id}.mp3`);
  if (scene.audio?.key === key && fs.existsSync(mp3)) return false;
  fs.mkdirSync(path.dirname(mp3), { recursive: true });
  let words = await synthesize(scene.narration, voice, mp3);
  const speech = await probeDuration(mp3);
  if (!words.length) words = estimateWords(scene.narration, speech);
  scene.audio = { key, file: `audio/${scene.id}.mp3`, speech: Math.round(speech * 1000) / 1000, words };
  return true;
}

function sceneDuration(p, i) {
  const s = p.scenes[i];
  const next = p.scenes[i + 1];
  const chapterEnd = !next || next.chapterId !== s.chapterId;
  return Math.round((s.audio.speech + PAD_AFTER + (chapterEnd ? PAD_CHAPTER_END : 0)) * 1000) / 1000;
}

/** Concatenate every scene's narration, each padded to its exact scene duration, into master.m4a. */
export async function buildMasterAudio(p) {
  const dir = projectDir(p.id, 'audio');
  const list = [];
  for (let i = 0; i < p.scenes.length; i++) {
    const s = p.scenes[i];
    s.duration = sceneDuration(p, i);
    const wav = path.join(dir, `${s.id}.pad.wav`);
    const stamp = `${s.audio.key}_${s.duration}`;
    if (s.audio.padded !== stamp || !fs.existsSync(wav)) {
      await ffmpeg(['-i', path.join(dir, `${s.id}.mp3`), '-af', `apad=whole_dur=${s.duration}`, '-t', String(s.duration), '-ar', '48000', '-ac', '1', wav]);
      s.audio.padded = stamp;
    }
    list.push(`file '${wav.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  }
  const listFile = path.join(dir, 'concat.txt');
  fs.writeFileSync(listFile, list.join('\n'));
  const master = projectDir(p.id, 'master.m4a');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', master]);
  const total = retime(p);
  p.masterAudio = { file: 'master.m4a', duration: total, builtAt: Date.now() };
  return total;
}

export async function runVoiceStage(p, signal) {
  const todo = p.scenes;
  let done = 0, changed = 0;
  progress(p, 'voice', 0, todo.length, 'Đang đọc lời thoại');
  const results = await pMap(todo, p.settings.voice.engine === 'ai33' ? 3 : 4, async scene => {
    if (signal?.aborted) throw new Error('Đã huỷ');
    const did = await voiceScene(p, scene);
    if (did) changed++;
    progress(p, 'voice', ++done, todo.length, 'Đang đọc lời thoại');
    return did;
  });
  const failed = results.filter(r => !r.ok);
  if (failed.length) throw new Error(`${failed.length} cảnh lỗi giọng đọc: ${failed[0].error.message}`);
  const sig = p.scenes.map(s => s.audio.key).join('');
  if (p.masterAudio?.sig === sig && fs.existsSync(projectDir(p.id, p.masterAudio.file))) return;
  const total = await buildMasterAudio(p);
  p.masterAudio.sig = sig;
  const words = p.scenes.reduce((a, s) => a + countWords(s.narration), 0);
  log(p, `Giọng đọc xong: ${p.scenes.length} cảnh, ${words} từ, tổng ${(total / 60).toFixed(1)} phút (${changed} cảnh mới đọc).`);
  save(p);
}

export async function revoiceScene(p, scene) {
  await voiceScene(p, scene);
  await buildMasterAudio(p);
  p.masterAudio.sig = p.scenes.map(s => s.audio?.key).join('');
  save(p);
}
