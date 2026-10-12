import React, { useEffect, useState } from 'react';
import { Trash2, UserRound, ImageOff } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

const LOOK = { male: 'Nam', female: 'Nữ', kid: 'trẻ em', adult: 'người lớn', elder: 'lớn tuổi' };

export default function Library() {
  const { meta, notify } = useApp();
  const [data, setData] = useState(null);
  const load = () => api.library().then(setData).catch(e => notify(e.message, true));
  useEffect(() => { load(); }, []);

  const delAsset = async a => {
    if (!confirm(`Xoá hình "${a.name}" khỏi thư viện? Video sau sẽ không dùng lại được nữa.`)) return;
    await api.deleteLibraryAsset(a.key); load();
  };
  const delImage = async a => {
    if (!confirm(`Xoá hình "${a.name}" khỏi thư viện?`)) return;
    await api.deleteLibraryImage(a.key); load();
  };
  const delCast = async c => {
    if (!confirm(`Xoá nhân vật "${c.role}" khỏi thư viện?`)) return;
    await api.deleteLibraryCast(c.id); load();
  };

  if (!data) return <div className="empty">Đang tải…</div>;
  const cast = data.cast.slice().sort((a, b) => (b.uses || 0) - (a.uses || 0));
  return (
    <div className="page fade-in" style={{ maxWidth: 1200 }}>
      <h1 style={{ marginBottom: 6 }}>Thư viện</h1>
      <p className="muted" style={{ margin: '0 0 24px' }}>Hình AI đã vẽ được giữ lại — video sau tự lấy ra dùng khi hợp nội dung, không tốn tiền vẽ lại.</p>

      <div className="card section">
        <div className="head"><h2>Hình AI ({(data.images || []).length})</h2><span className="hint">Hình tách nền và ảnh nền do model ảnh vẽ.</span></div>
        {!(data.images || []).length ? <div className="hint">Chưa có hình nào.</div> : (
          <div className="lib-grid">
            {data.images.map(a => (
              <div key={a.key} className="lib-card">
                <div className="lib-thumb" style={{ background: 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/20px 20px' }}><img src={a.url} alt={a.name} loading="lazy" style={a.kind === 'bg' ? { objectFit: 'cover', width: '100%', height: '100%' } : null} /></div>
                <div className="lib-info"><b>{a.name}</b><span>{a.kind === 'bg' ? 'Ảnh nền' : 'Hình tách nền'}</span><span className="pill">{a.uses} lần dùng</span></div>
                <button className="btn icon sm ghost" title="Xoá" onClick={() => delImage(a)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card section">
        <div className="head"><h2>Nhân vật ({cast.length})</h2><span className="hint">Người dẫn dùng nhiều nhất sẽ được ưu tiên làm "người dẫn quen thuộc" của kênh.</span></div>
        {cast.length === 0 ? <div className="hint">Chưa có — nhân vật sẽ được lưu sau video hoạt hình đầu tiên.</div> : (
          <div className="lib-grid">
            {cast.map(c => (
              <div key={c.id} className="lib-card">
                <div className="lib-person" style={{ background: c.look?.shirt || 'var(--bg-2)' }}><UserRound size={44} color="#fff" /></div>
                <div className="lib-info">
                  <b>{c.role || c.name}</b>
                  <span>{[LOOK[c.look?.gender], LOOK[c.look?.age], c.look?.outfit, c.look?.glasses && 'đeo kính'].filter(Boolean).join(' · ')}</span>
                  <span className="pill">{c.uses || 0} video</span>
                </div>
                <button className="btn icon sm ghost" title="Xoá" onClick={() => delCast(c)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card section">
        <div className="head"><h2>Hình vẽ Astra ({data.assets.length})</h2></div>
        {data.assets.length === 0 ? <div className="hint">Chưa có hình nào.</div> : (
          <div className="lib-grid">
            {data.assets.map(a => (
              <div key={a.key} className={`lib-card ${a.reusable ? '' : 'off'}`}>
                <div className="lib-thumb"><img src={a.url} alt={a.name} loading="lazy" /></div>
                <div className="lib-info">
                  <b>{a.name}</b>
                  <span>{meta.styles[a.style]?.name || a.style}</span>
                  {a.reusable ? <span className="pill">{a.uses} lần dùng lại</span>
                    : a.reviewIssues ? <span className="pill warn" title={a.reviewIssues.join('\n')}><ImageOff size={11} /> không dùng lại — Luna loại: {String(a.reviewIssues[0] || '').slice(0, 70)}…</span>
                    : <span className="pill warn"><ImageOff size={11} /> không dùng lại (bản đồ/cờ/chân dung tĩnh)</span>}
                </div>
                <button className="btn icon sm ghost" title="Xoá" onClick={() => delAsset(a)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
