import path from 'path';
import { LIBRARY_DIR } from './config.js';
import { readJson, writeJsonAtomic } from './util.js';

// Cartoon characters created for earlier videos (look + role), so the channel keeps a familiar host and
// later videos can reuse a character instead of inventing a new one.
const FILE = path.join(LIBRARY_DIR, 'cast.json');
const sameLook = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

export function saveCastList(list) {
  writeJsonAtomic(FILE, list);
}

export function listCast() {
  return readJson(FILE, []);
}

/** Save/refresh the cast of a project (same id + same look = the same character; bumps its use count). */
export function rememberCast(cast) {
  if (!cast?.length) return;
  const lib = listCast();
  for (const c of cast) {
    let e = lib.find(x => x.id === c.id && sameLook(x.look, c.look));
    if (!e) {
      let id = c.id, n = 2;
      while (lib.some(x => x.id === id)) id = `${c.id}_${n++}`;
      e = { id, name: c.name, role: c.role, look: c.look, uses: 0, createdAt: Date.now() };
      lib.push(e); // the project keeps its own id (scene code refers to it); only the library copy is renamed
    }
    e.uses = (e.uses || 0) + 1;
    e.lastUsed = Date.now();
    e.role = c.role || e.role;
  }
  writeJsonAtomic(FILE, lib);
}

const lookText = l => [l?.gender === 'female' ? 'nữ' : 'nam', l?.age, l?.hair, l?.outfit, l?.shirt && `áo ${l.shirt}`, l?.glasses && 'kính', l?.hat && l.hat !== 'none' && l.hat].filter(Boolean).join(', ');

/** Prompt block listing reusable characters (most used first); the host role is what keeps the channel recognisable. */
export function castLibraryText(limit = 10) {
  const lib = listCast().slice().sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, limit);
  if (!lib.length) return '';
  return lib.map(c => `- "${c.id}": ${c.role} (${lookText(c.look)}) — đã dùng ${c.uses || 1} video`).join('\n');
}

export function castFromLibrary(id) {
  const c = listCast().find(x => x.id === id);
  return c ? { id: c.id, name: c.name, role: c.role, look: c.look } : null;
}
