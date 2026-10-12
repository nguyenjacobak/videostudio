import React, { useEffect, useState } from 'react';
import { Plus, Film, Clock, Layers, Trash2, Loader2 } from 'lucide-react';
import { api, fmtTime, timeAgo } from '../api.js';
import { useApp, go } from '../App.jsx';

export const STATUS = {
  draft: ['Nháp', ''],
  running: ['Đang sản xuất', 'brand'],
  awaiting_review: ['Chờ duyệt kịch bản', 'warn'],
  ready: ['Sẵn sàng xuất', 'ok'],
  done: ['Đã xuất video', 'ok'],
  error: ['Có lỗi — cần tiếp tục', 'err'],
};

export default function Home() {
  const { meta, notify } = useApp();
  const [list, setList] = useState(null);

  const load = () => api.projects().then(setList).catch(e => notify(e.message, true));
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const remove = async (e, p) => {
    e.stopPropagation();
    if (!confirm(`Xoá dự án "${p.title}"? Toàn bộ âm thanh, cảnh và video của dự án sẽ bị xoá.`)) return;
    await api.remove(p.id);
    load();
  };

  return (
    <div className="page fade-in">
      <div className="hero">
        <div>
          <h1>Dự án video</h1>
          <p>Nhập một chủ đề — AI viết kịch bản, lồng tiếng, dựng đồ họa và xuất video 7–15 phút.</p>
        </div>
        <button className="btn primary big" onClick={() => go('new')}><Plus size={18} /> Tạo video mới</button>
      </div>

      {!list ? <div className="empty">Đang tải…</div> : (
        <div className="proj-grid">
          <button className="card new-card" onClick={() => go('new')}>
            <div className="plus"><Plus size={26} /></div>
            Video mới
            <span className="hint">Khoa học · Kinh tế · Chính trị · Lịch sử</span>
          </button>
          {list.map(p => {
            const [label, cls] = STATUS[p.status] || STATUS.draft;
            return (
              <div key={p.id} className="card proj" onClick={() => go(`p/${p.id}`)}>
                <div className="thumb">
                  {p.thumb ? <img src={p.thumb} alt="" /> : <Film size={34} color="var(--text-3)" />}
                  <span className={`pill ${cls}`}>{p.busy && <Loader2 size={12} className="spin" />}{p.busy || label}</span>
                </div>
                <div className="body">
                  <div className="title">{p.title}</div>
                  <div className="meta">
                    <span className="row" style={{ gap: 5 }}><Clock size={13} />{p.duration ? fmtTime(p.duration) : p.minutes ? `~${p.minutes} phút` : "Tự động"}</span>
                    <span className="row" style={{ gap: 5 }}><Layers size={13} />{p.scenes} cảnh</span>
                    <span>Hoạt hình 2D</span>
                  </div>
                  <div className="between" style={{ marginTop: 10 }}>
                    <span className="hint">{timeAgo(p.updatedAt)}</span>
                    <button className="btn ghost sm icon danger" title="Xoá" onClick={e => remove(e, p)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
