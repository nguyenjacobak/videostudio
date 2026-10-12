import React, { useState } from 'react';
import { Plus, Trash2, ClipboardCheck, AlertTriangle, Loader2, RotateCcw, Eye } from 'lucide-react';
import { api } from '../api.js';

const ENV_NAMES = { city: 'Phố thị', street: 'Dãy cửa hàng', market: 'Chợ', village: 'Làng quê', countryside: 'Làng quê', ricefield: 'Ruộng lúa', farm: 'Nông trại', factory: 'Nhà máy', lab: 'Phòng thí nghiệm', office: 'Văn phòng', home: 'Trong nhà', ancient: 'Cổ đại', ocean: 'Biển', port: 'Cảng biển', river: 'Sông', underwater: 'Dưới nước', mountains: 'Núi', forest: 'Rừng', desert: 'Sa mạc', arctic: 'Bắc Cực', space: 'Vũ trụ', orbit: 'Quỹ đạo', earth: 'Trái Đất', moon: 'Mặt Trăng', bloodstream: 'Mạch máu', cell: 'Tế bào', molecules: 'Phân tử', digital: 'Không gian số', abstract: 'Nền sơ đồ', classroom: 'Lớp học', studio: 'Trường quay', bank: 'Ngân hàng' };
const SHOT_NAMES = { wide: 'toàn cảnh', medium: 'trung cảnh', close: 'cận cảnh', macro: 'vi mô', diagram: 'sơ đồ', data: 'số liệu' };

function SceneLine({ p, s, i, act }) {
  const [narration, setNarration] = useState(s.narration);
  const [visual, setVisual] = useState(s.visual);
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  const secs = s.voiced && s.duration ? s.duration : (words / p.wordsPerMinute) * 60;
  const saveField = (key, val) => {
    if (val.trim() === s[key]) return;
    act(() => api.updateScene(p.id, s.id, { [key]: val }));
  };
  return (
    <div className="sline">
      <div className="idx">{i + 1}</div>
      <div>
        <textarea value={narration} onChange={e => setNarration(e.target.value)} onBlur={() => saveField('narration', narration)} rows={2} />
        <div className="row" style={{ paddingLeft: 9, gap: 8 }}>
          <span className="hint">{words} từ · ~{Math.round(secs)}s</span>
          {p.stages.voice.state !== 'pending' && !s.voiced && <span className="pill warn">cần đọc lại</span>}
          <div className="tools">
            <button className="btn ghost sm" disabled={!!p.busy} onClick={() => act(() => api.addScene(p.id, { afterIndex: i }))}><Plus size={13} /> Thêm cảnh sau</button>
            <button className="btn ghost sm danger" disabled={!!p.busy} onClick={() => confirm('Xoá cảnh này?') && act(() => api.deleteScene(p.id, s.id))}><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
      <div className="vis">
        <div className="row" style={{ gap: 6, marginBottom: 2 }}><Eye size={12} /><b style={{ fontSize: 11.5 }}>{s.form || [ENV_NAMES[s.env || s.setting] || s.env || s.setting, SHOT_NAMES[s.shot]].filter(Boolean).join(' · ') || 'Minh họa'}{s.items?.length ? ` — ${s.items.join(', ')}` : ''}</b>{s.characters?.length > 0 && <span className="hint">· {s.characters.map(id => p.cast?.find(c => c.id === id)?.name || id).join(', ')}</span>}</div>
        <textarea value={visual} onChange={e => setVisual(e.target.value)} onBlur={() => saveField('visual', visual)} rows={3} placeholder="Mô tả hình ảnh cho cảnh này…" />
      </div>
    </div>
  );
}

export default function ScriptTab({ p, act }) {
  if (!p.outline) {
    return (
      <div className="empty">
        {p.busy ? <><Loader2 className="spin" size={28} /><p>Flash đang lập dàn ý và viết kịch bản…<br />thường mất 1–2 phút.</p></> : <p>Chưa có kịch bản. Bấm <b>Tiếp tục</b> để bắt đầu.</p>}
      </div>
    );
  }
  const chapters = p.outline.chapters;
  const fromScript = !!p.brief?.script;
  const rewrite = () => {
    if (!confirm(fromScript ? 'Chia cảnh và nghĩ lại hình minh họa từ kịch bản gốc của bạn? Mọi chỉnh sửa, giọng đọc và cảnh đã dựng sẽ bị xoá.' : 'Viết lại toàn bộ kịch bản từ đầu? Mọi chỉnh sửa, giọng đọc và cảnh đã dựng sẽ bị xoá.')) return;
    act(() => api.rewrite(p.id));
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1100 }}>
      {p.status === 'awaiting_review' && (
        <div className="banner brand">
          <ClipboardCheck size={22} color="var(--brand-2)" />
          <div className="grow"><b>Kịch bản chờ bạn duyệt</b><span>Đọc lướt, sửa trực tiếp lời thoại hoặc ý tưởng hình ảnh (tự lưu khi rời ô). Xong thì bấm duyệt để lồng tiếng và dựng cảnh.</span></div>
          <button className="btn primary" onClick={() => act(() => api.approve(p.id), 'Bắt đầu lồng tiếng & dựng cảnh')}>Duyệt kịch bản</button>
        </div>
      )}
      {p.factWarnings?.length > 0 && (
        <div className="banner warn">
          <AlertTriangle size={20} color="var(--warn)" />
          <div className="grow"><b>Biên tập viên AI khuyên bạn tự kiểm chứng</b>{p.factWarnings.map((w, i) => <span key={i} style={{ display: 'block', marginTop: 3 }}>• {w}</span>)}</div>
        </div>
      )}
      <div className="between" style={{ marginBottom: 18 }}>
        <div>
          <h2>{p.outline.title}</h2>
          <div className="muted" style={{ marginTop: 4, maxWidth: 800 }}>{p.outline.angle}</div>
          {p.cast?.length > 0 && <div className="chips" style={{ marginTop: 10 }}>{p.cast.map(c => <span key={c.id} className="pill brand" title={c.role}>🎭 {c.name} · {c.role}</span>)}</div>}
        </div>
        <div className="row">
          <span className="pill">{p.wordCount.toLocaleString('vi-VN')} từ · ~{(p.wordCount / p.wordsPerMinute).toFixed(1)} phút</span>
          <button className="btn sm" disabled={!!p.busy} onClick={rewrite}><RotateCcw size={13} /> {fromScript ? "Chia lại từ kịch bản gốc" : "Viết lại"}</button>
        </div>
      </div>
      {chapters.map((ch, ci) => {
        const list = p.scenes.map((s, i) => [s, i]).filter(([s]) => s.chapterId === ch.id);
        if (!list.length) return null;
        return (
          <div className="chapter" key={ch.id}>
            <div className="chapter-head"><span className="no">PHẦN {ci + 1}</span><h3>{ch.title}</h3><span className="hint">— {ch.purpose}</span></div>
            {list.map(([s, i]) => <SceneLine key={s.id + s.narration.length} p={p} s={s} i={i} act={act} />)}
          </div>
        );
      })}
    </div>
  );
}
