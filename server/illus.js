import { createRequire } from 'module';
import { normalizeText } from './util.js';

// Professional flat illustrations (Microsoft Fluent Emoji Flat, MIT) + round country flags (circle-flags, MIT).
// Scenes reference them by name (data-illus="bank", data-flag="vn"); the AI never hand-draws objects.
const require = createRequire(import.meta.url);
const EMOJI = require('@iconify-json/fluent-emoji-flat/icons.json');
const FLAGS = require('@iconify-json/circle-flags/icons.json');

const SKIN = /-(light|medium|dark|medium-light|medium-dark)$/;
const USELESS = /(-button$|^keycap|oclock$|-thirty$|^input-|arrow|^regional|^flag-in-hole|^japanese-|-mark$|^heavy-|^white-|^black-(small|medium|large)|-square$|-circle$|-triangle$|-diamond$|^cross-|^cancer$|^aries$|^taurus$|^gemini$|^leo$|^virgo$|^libra$|^scorpio$|^sagittarius$|^capricorn$|^aquarius$|^pisces$|^ophiuchus$)/;

// Stylised maps/globes are not geographically accurate — maps come only from real data (kit.worldMap, g.globe…).
const GEO = /^(world-map|map-of-japan|globe-showing-.*)$/;
const ALL = Object.keys(EMOJI.icons).filter(n => !GEO.test(n));
export const ILLUS_NAMES = ALL.filter(n => !SKIN.test(n) && !USELESS.test(n)).sort();
const tokens = new Map(ALL.filter(n => !SKIN.test(n)).map(n => [n, new Set(n.split('-'))]));

const cache = new Map();

/** Map any requested name to a real illustration name (exact → skin-tone base → best token overlap). */
export function resolveIllus(name) {
  const raw = String(name || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/^fluent-emoji-flat:/, '');
  if (cache.has(raw)) return cache.get(raw);
  let hit = null;
  if (EMOJI.icons[raw] && !GEO.test(raw)) hit = raw;
  else if (EMOJI.aliases?.[raw] && !GEO.test(EMOJI.aliases[raw].parent)) hit = EMOJI.aliases[raw].parent;
  else {
    const want = new Set(raw.split('-').filter(Boolean));
    let best = 0;
    for (const [n, toks] of tokens) {
      let inter = 0;
      for (const t of want) if (toks.has(t)) inter++;
      const score = inter / (want.size + toks.size - inter);
      if (score > best) { best = score; hit = n; }
    }
    if (best < 0.34) {
      // Every requested word present → take the shortest such name ("globe" → "globe-with-meridians").
      hit = [...tokens.entries()].filter(([, toks]) => [...want].every(t => toks.has(t))).map(([n]) => n).sort((a, b) => a.length - b.length)[0] || null;
    }
  }
  cache.set(raw, hit);
  return hit;
}

function toSvg(set, name) {
  const icon = set.icons[name];
  const w = icon.width || set.width || 32, h = icon.height || set.height || 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">${icon.body}</svg>`;
}

export function illusSvg(name) {
  const n = resolveIllus(name);
  return n ? toSvg(EMOJI, n) : null;
}

const FLAG_ALIASES = { vietnam: 'vn', 'viet-nam': 'vn', usa: 'us', my: 'us', 'hoa-ky': 'us', china: 'cn', 'trung-quoc': 'cn', japan: 'jp', 'nhat-ban': 'jp', russia: 'ru', nga: 'ru', uk: 'gb', anh: 'gb', korea: 'kr', 'han-quoc': 'kr', germany: 'de', duc: 'de', france: 'fr', phap: 'fr', india: 'in', 'an-do': 'in', ukraine: 'ua', eu: 'eu', 'chau-au': 'eu' };
export function flagSvg(code) {
  let c = normalizeText(code).replace(/\s+/g, '-');
  c = FLAG_ALIASES[c] || c;
  return FLAGS.icons[c] ? toSvg(FLAGS, c) : null;
}

/** Collect every illustration/flag a scene's code refers to and return them as inline SVG maps. */
export function collectIllus(codes) {
  const illus = {}, flags = {};
  const text = codes.map(c => `${c?.html || ''}\n${c?.js || ''}`).join('\n');
  const grab = (re, into, fn) => { for (const m of text.matchAll(re)) if (!(m[1] in into)) { const svg = fn(m[1]); if (svg) into[m[1]] = svg; } };
  grab(/data-illus=["']([^"'$]+)["']/g, illus, illusSvg);
  grab(/kit\.illus\(\s*["']([^"']+)["']/g, illus, illusSvg);
  grab(/kit\.crowd\([^,]+,\s*["']([^"']+)["']/g, illus, illusSvg);
  // Names held in JS arrays/variables: any string literal that is exactly an illustration name.
  for (const m of text.matchAll(/["'`]([a-z0-9]+(?:-[a-z0-9]+)*)["'`]/g)) if (!(m[1] in illus) && EMOJI.icons[m[1]]) illus[m[1]] = toSvg(EMOJI, m[1]);
  grab(/data-flag=["']([^"'$]+)["']/g, flags, flagSvg);
  grab(/kit\.flag\(\s*["']([^"']+)["']/g, flags, flagSvg);
  return { illus, flags };
}

export const illusCatalog = () => ILLUS_NAMES.join(', ');
