import { chromium } from 'playwright-core';
import { findBrowser, PORT } from './config.js';
import { Semaphore } from './util.js';

let browserPromise = null;

export async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.isConnected()) return b;
  }
  browserPromise = chromium.launch({
    executablePath: findBrowser(),
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--mute-audio',
    ],
  });
  return browserPromise;
}

export async function closeBrowser() {
  const b = await browserPromise?.catch(() => null);
  browserPromise = null;
  await b?.close().catch(() => {});
}

export const playerUrl = (query = '') => `http://127.0.0.1:${PORT}/runtime/player.html${query}`;

/** Open a page on the player and wait for the runtime to boot. */
export async function openPlayer({ width = 1920, height = 1080, query = '?qa=1' } = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(playerUrl(query), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rt && window.__rt.ready);
  await page.evaluate(() => window.__rt.ready);
  return { page, context, close: () => context.close().catch(() => {}) };
}

/** Render a standalone SVG on a neutral background → JPEG data URL (for the vision model to check an Astra drawing). */
export async function snapshotSvg(svg, size = 640) {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await page.setContent(`<body style="margin:0;background:#f3efe6"><div style="width:${size}px;height:${size}px">${svg}</div></body>`);
    const buf = await page.screenshot({ type: 'jpeg', quality: 80 });
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } finally {
    await context.close().catch(() => {});
  }
}

// ---------- QA pool ----------
const qaSem = new Semaphore(3);
const idle = [];

async function withQaPage(fn) {
  return qaSem.run(async () => {
    let h = idle.pop();
    if (!h || h.uses > 25 || h.page.isClosed()) {
      h?.close();
      h = await openPlayer({ width: 960, height: 540, query: '?qa=1' });
      h.uses = 0;
    }
    h.uses++;
    try {
      const out = await fn(h.page);
      idle.push(h);
      return out;
    } catch (err) {
      h.close();
      throw err;
    }
  });
}

/**
 * Mount one scene in isolation, probe several instants for JS errors and layout problems,
 * and grab a thumbnail. Returns { errors, warnings, issues, thumb(Buffer) }.
 */
export async function inspectScene(runtimeData, { frames: wantFrames = false } = {}) {
  return withQaPage(async page => {
    await page.evaluate(d => window.__rt.load(d), runtimeData);
    const D = runtimeData.duration;
    const probes = [0.3, D * 0.35, D * 0.65, D - 0.1].filter(t => t > 0);
    const issues = new Set();
    for (const t of probes) {
      const r = await page.evaluate(async ([t, final]) => { await window.__rt.seek(t); return window.__rt.inspect({ final }); }, [t, t === probes[probes.length - 1]]);
      for (const i of r.issues) issues.add(i);
    }
    await page.evaluate(async t => window.__rt.seek(t), D * 0.62);
    const thumb = await page.screenshot({ type: 'jpeg', quality: 72 });
    const frames = [];
    if (wantFrames) {
      // Early, middle and end of the scene, for the vision reviewer (an empty opening is a defect too).
      for (const t of [D * 0.25, D * 0.55, Math.max(0, D - 0.15)]) {
        await page.evaluate(async t => window.__rt.seek(t), t);
        frames.push('data:image/jpeg;base64,' + (await page.screenshot({ type: 'jpeg', quality: 78 })).toString('base64'));
      }
    }
    const { errors, warnings } = await page.evaluate(() => ({ errors: window.__rt.errors, warnings: window.__rt.warnings }));
    return { errors, warnings, issues: [...issues], thumb, frames };
  });
}
