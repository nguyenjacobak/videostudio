import { STYLES } from './styles.js';
import { loadAssetsSvg } from './pipeline/art.js';
import { collectIllus } from './illus.js';
import { imagesForRuntime } from './pipeline/images.js';

function styleOf(p) {
  if (p.style) return { tokens: p.style.tokens, ambient: p.style.ambient };
  const preset = STYLES.cartoon;
  return { tokens: preset.tokens, ambient: preset.ambient };
}

function sceneEntry(p, s, i, start, code = s.code) {
  const prev = p.scenes[i - 1];
  const chIdx = p.outline?.chapters.findIndex(c => c.id === s.chapterId) ?? -1;
  return {
    id: s.id,
    index: i,
    start,
    duration: s.duration || 5,
    narration: s.narration,
    words: s.audio?.words || [],
    html: code?.html || '',
    css: code?.css || '',
    js: code?.js || '',
    isChapterStart: !prev || prev.chapterId !== s.chapterId,
    transition: s.transition || null,
    setting: (code?.js || '').match(/kit\.world\(\s*['"]([a-z]+)['"]/)?.[1] || null,
    chapter: chIdx >= 0 ? { index: chIdx, title: p.outline.chapters[chIdx].title } : null,
  };
}

/** Everything the browser runtime needs to play the whole video (or one scene). */
export function buildRuntimeData(p, { sceneId, code } = {}) {
  const base = {
    projectId: p.id,
    style: styleOf(p),
    captions: !!p.settings.captions,
    assets: loadAssetsSvg(p),
    images: imagesForRuntime(p),
    cast: Object.fromEntries((p.cast || []).map(c => [c.id, c.look])),
  };
  if (sceneId) {
    const i = p.scenes.findIndex(s => s.id === sceneId);
    if (i < 0) throw Object.assign(new Error('Không tìm thấy cảnh'), { status: 404 });
    const s = p.scenes[i];
    return {
      ...base,
      ...collectIllus([code || s.code]),
      duration: s.duration || 5,
      audio: s.audio ? `/files/${p.id}/${s.audio.file}?v=${s.audio.key}` : null,
      scenes: [sceneEntry(p, s, i, 0, code || s.code)],
    };
  }
  const scenes = p.scenes.filter(s => s.duration > 0).map(s => sceneEntry(p, s, p.scenes.indexOf(s), s.start));
  return {
    ...base,
    ...collectIllus(p.scenes.map(x => x.code)),
    duration: scenes.reduce((a, s) => Math.max(a, s.start + s.duration), 0),
    audio: p.masterAudio ? `/files/${p.id}/${p.masterAudio.file}?v=${p.masterAudio.builtAt}` : null,
    scenes,
  };
}
