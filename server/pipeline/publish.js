import { chatJson } from '../llm.js';
import { publishPrompt } from '../prompts.js';
import { save, log, usageRecorder } from '../store.js';
import { formatTime } from '../util.js';
import { chapterMarkers } from './render.js';

export async function runPublish(p, signal) {
  const markers = chapterMarkers(p);
  const chaptersText = markers.map(m => `${formatTime(m.t)} ${m.title}`).join('\n');
  const r = await chatJson({ role: 'flash', messages: publishPrompt(p, chaptersText), temperature: 0.8, maxTokens: 4000, onUsage: usageRecorder(p), signal });
  p.publish = {
    titles: (r.titles || []).slice(0, 5),
    description: `${String(r.description || '').trim()}\n\n📌 Nội dung:\n${chaptersText}`,
    tags: (r.tags || []).slice(0, 20),
    thumbnailText: (r.thumbnailText || []).slice(0, 3),
    chapters: chaptersText,
  };
  log(p, 'Đã tạo tiêu đề, mô tả (kèm mốc chương) và thẻ cho YouTube.');
  save(p);
}
