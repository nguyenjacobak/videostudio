import { save, log, bus } from '../store.js';
import { sleep } from '../util.js';
import { runScriptStage } from './script.js';
import { runVoiceStage } from './voice.js';
import { runImagesStage } from './images.js';
import { runScenesStage } from './scenes.js';
import { runRender } from './render.js';
import { runPublish } from './publish.js';

// One job per project at a time; renders are additionally serialized machine-wide (CPU heavy).
const jobs = new Map();
let renderChain = Promise.resolve();

export const isBusy = id => jobs.has(id);
export const jobLabel = id => jobs.get(id)?.label || null;

export function cancelJob(id) {
  const j = jobs.get(id);
  if (!j) return false;
  j.ac.abort();
  return true;
}

/** Run `fn` as the project's single active job. Throws if another job is running. */
export function runJob(p, label, fn) {
  if (jobs.has(p.id)) throw Object.assign(new Error(`Dự án đang bận: ${jobs.get(p.id).label}`), { status: 409 });
  const ac = new AbortController();
  const job = { ac, label };
  jobs.set(p.id, job);
  bus.emit('job', p.id, label);
  job.promise = (async () => {
    try { await fn(ac.signal); }
    catch (err) {
      log(p, ac.signal.aborted ? 'Đã dừng theo yêu cầu.' : `Lỗi: ${err.message}`, ac.signal.aborted ? 'warn' : 'error');
    } finally {
      jobs.delete(p.id);
      bus.emit('job', p.id, null);
      save(p);
    }
  })();
  return job.promise;
}

const STAGE_NAMES = { script: 'kịch bản', voice: 'giọng đọc', art: 'ảnh minh họa', scenes: 'dựng cảnh', render: 'xuất video' };

/**
 * Run one stage. Transient failures (network, API hiccups, a render worker dying) are retried automatically with growing
 * pauses — every stage resumes from where it stopped, so a retry never redoes finished work. Fatal errors (bad API key,
 * out of credit) and user cancellation stop immediately.
 */
async function stage(p, name, fn, signal) {
  const st = p.stages[name];
  const waits = [20, 60, 180];
  for (let attempt = 0; ; attempt++) {
    st.state = 'running'; st.error = null; st.startedAt = Date.now();
    save(p);
    try {
      await fn(p, signal);
      st.state = 'done'; st.doneAt = Date.now(); st.progress = null;
      save(p);
      return;
    } catch (err) {
      if (!signal?.aborted && !err.fatal && attempt < waits.length) {
        log(p, `Bước ${STAGE_NAMES[name] || name} gặp lỗi: ${String(err.message).slice(0, 200)} — tự chạy lại sau ${waits[attempt]} giây (lần ${attempt + 1}/${waits.length}).`, 'warn');
        st.state = 'retrying'; st.error = err.message; save(p);
        await sleep(waits[attempt] * 1000);
        if (!signal?.aborted) continue;
      }
      st.state = 'error';
      st.error = signal?.aborted ? 'Đã dừng' : err.message;
      p.status = 'error';
      save(p);
      throw err;
    }
  }
}

export function renderQueued(p, signal) {
  const run = renderChain.then(() => stage(p, 'render', runRender, signal));
  renderChain = run.catch(() => {});
  return run;
}

/**
 * Full pipeline: script → (review gate) → voice → art → scenes → publish metadata → render.
 * Each stage skips work that's already done, so this is also "resume".
 */
export function startPipeline(p, { render } = {}) {
  return runJob(p, 'Đang sản xuất', async signal => {
    p.status = 'running';
    save(p);
    if (!p.scenes.length || !p.outline || p.stages.script.state !== 'done') await stage(p, 'script', runScriptStage, signal);
    if (p.settings.mode === 'review' && !p.scriptApproved) {
      p.status = 'awaiting_review';
      log(p, '📝 Kịch bản đã sẵn sàng — hãy đọc, chỉnh sửa rồi bấm "Duyệt kịch bản".');
      save(p);
      return;
    }
    await stage(p, 'voice', runVoiceStage, signal);
    if (!Array.isArray(p.images) || p.stages.art.state !== 'done') await stage(p, 'art', runImagesStage, signal);
    await stage(p, 'scenes', runScenesStage, signal);
    if (!p.publish) await runPublish(p, signal).catch(err => log(p, `Không tạo được metadata YouTube: ${err.message}`, 'warn'));
    p.status = 'ready';
    save(p);
    const shouldRender = render ?? p.settings.mode === 'auto';
    if (shouldRender) {
      await renderQueued(p, signal);
      p.status = 'done';
    } else {
      log(p, '🎬 Tất cả cảnh đã dựng xong. Xem trước, chỉnh cảnh nếu cần, rồi bấm "Xuất video".');
    }
    save(p);
  });
}

export function startRender(p) {
  return runJob(p, 'Đang xuất video', async signal => {
    p.status = 'running';
    await renderQueued(p, signal);
    p.status = 'done';
  });
}
