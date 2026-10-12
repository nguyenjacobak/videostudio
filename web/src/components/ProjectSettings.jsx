import React, { useState } from 'react';
import { Save, Upload } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { VoicePicker } from '../pages/Create.jsx';

export default function ProjectSettings({ p, act }) {
  const { meta, reloadMeta } = useApp();
  const [s, setS] = useState(p.settings);
  const set = patch => setS(x => ({ ...x, ...patch }));
  const voiceChanged = JSON.stringify(s.voice) !== JSON.stringify(p.settings.voice);

  const saveAll = () => {
    act(() => api.update(p.id, { settings: s }), 'Đã lưu thiết lập' + (voiceChanged ? ' — bấm "Cập nhật" để áp dụng' : ''));
  };
  const uploadMusic = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = await api.uploadMusic(file);
    await reloadMeta();
    set({ music: r.name });
  };

  return (
    <div className="fade-in" style={{ maxWidth: 900 }}>
      <div className="card" style={{ padding: 20, marginBottom: 14 }}>
        <h2 style={{ marginBottom: 14 }}>Giọng đọc</h2>
        <VoicePicker voices={meta.voices} value={s.voice} onChange={voice => set({ voice })} />
        {voiceChanged && <div className="hint" style={{ marginTop: 10, color: 'var(--warn)' }}>Đổi giọng → toàn bộ lời thoại sẽ được đọc lại (miễn phí với Edge), thời lượng cảnh có thể thay đổi.</div>}
      </div>
      <div className="card" style={{ padding: 20, marginBottom: 14 }}>
        <h2 style={{ marginBottom: 14 }}>Khác</h2>
        <div className="form-grid">
          <div>
            <label className="label">Nhạc nền</label>
            <div className="row">
              <select className="select" value={s.music} onChange={e => set({ music: e.target.value })}>
                <option value="">Không dùng</option>
                {meta.music.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <label className="btn icon" title="Tải nhạc lên"><Upload size={15} /><input type="file" accept="audio/*" hidden onChange={uploadMusic} /></label>
            </div>
          </div>
          <div>
            <label className="label">Âm lượng nhạc nền: {Math.round((s.musicVolume || 0.12) * 100)}%</label>
            <input type="range" min="0.03" max="0.35" step="0.01" value={s.musicVolume || 0.12} onChange={e => set({ musicVolume: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--brand)' }} />
          </div>
          <div className="full">
            <span className={`toggle ${s.captions ? 'on' : ''}`} onClick={() => set({ captions: !s.captions })}><span className="sw" /> Phụ đề karaoke trong video</span>
          </div>
        </div>
      </div>
      <button className="btn primary big" disabled={!!p.busy} onClick={saveAll}><Save size={16} /> Lưu thiết lập</button>
    </div>
  );
}
