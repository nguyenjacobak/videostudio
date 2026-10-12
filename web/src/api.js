async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

export const api = {
  meta: () => request('GET', '/api/meta'),
  settings: () => request('GET', '/api/settings'),
  library: () => request('GET', '/api/library'),
  deleteLibraryAsset: key => request('DELETE', `/api/library/assets/${encodeURIComponent(key)}`),
  deleteLibraryImage: key => request('DELETE', `/api/library/images/${encodeURIComponent(key)}`),
  deleteLibraryCast: id => request('DELETE', `/api/library/cast/${encodeURIComponent(id)}`),
  saveSettings: s => request('PUT', '/api/settings', s),
  projects: () => request('GET', '/api/projects'),
  project: id => request('GET', `/api/projects/${id}`),
  create: body => request('POST', '/api/projects', body),
  update: (id, body) => request('PATCH', `/api/projects/${id}`, body),
  remove: id => request('DELETE', `/api/projects/${id}`),
  run: (id, body = {}) => request('POST', `/api/projects/${id}/run`, body),
  approve: id => request('POST', `/api/projects/${id}/approve`, {}),
  rewrite: (id, brief) => request('POST', `/api/projects/${id}/rewrite`, { brief }),
  cancel: id => request('POST', `/api/projects/${id}/cancel`, {}),
  render: id => request('POST', `/api/projects/${id}/render`, {}),
  publish: id => request('POST', `/api/projects/${id}/publish`, {}),
  log: id => request('GET', `/api/projects/${id}/log`),
  scene: (id, sid) => request('GET', `/api/projects/${id}/scenes/${sid}`),
  updateScene: (id, sid, body) => request('PATCH', `/api/projects/${id}/scenes/${sid}`, body),
  addScene: (id, body) => request('POST', `/api/projects/${id}/scenes`, body),
  deleteScene: (id, sid) => request('DELETE', `/api/projects/${id}/scenes/${sid}`),
  regenerate: (id, sid, body) => request('POST', `/api/projects/${id}/scenes/${sid}/regenerate`, body),
  revoice: (id, sid) => request('POST', `/api/projects/${id}/scenes/${sid}/revoice`, {}),
  saveCode: (id, sid, code) => request('PUT', `/api/projects/${id}/scenes/${sid}/code`, code),
  uploadMusic: async file => {
    const res = await fetch('/api/music', { method: 'POST', headers: { 'x-filename': encodeURIComponent(file.name).replace(/%/g, '_') }, body: file });
    return res.json();
  },
};

export function fmtTime(sec = 0) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function timeAgo(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'vừa xong';
  if (d < 3600) return `${Math.floor(d / 60)} phút trước`;
  if (d < 86400) return `${Math.floor(d / 3600)} giờ trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}
