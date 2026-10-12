import React, { useEffect, useState } from 'react';
import { X, Wand2, Mic, Code2, Save, AlertTriangle, ImageOff, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, fmtTime } from '../api.js';
import { useApp } from '../App.jsx';

const BY = { flash: ['Flash', 'brand'], coder: ['AI', 'brand'], astra: ['Astra', 'astra'], manual: ['Thủ công', 'ok'], fallback: ['Mẫu an toàn', 'err'] };
const shortModel = m => (m || '').split('/').pop().replace(/-(high|preview)$/, '');
const byOf = s => { const b = BY[s.codeBy]; if (!b) return []; return s.codeBy === 'coder' || s.codeBy === 'flash' ? [shortModel(s.codeModel) || b[0], b[1]] : b; };

function SceneDrawer({ p, index, onClose, onNav, act }) {
  const { notify } = useApp();
  const s = p.scenes[index];
  const [full, setFull] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeTab, setCodeTab] = useState('html');
  const [code, setCode] = useState({ html: '', css: '', js: '' });
  const [saving, setSaving] = useState(false);
  const [ver, setVer] = useState(0);

  useEffect(() => {
    api.scene(p.id, s.id).then(x => { setFull(x); setCode({ html: x.code?.html || '', css: x.code?.css || '', js: x.code?.js || '' }); });
  }, [p.id, s.id, s.thumb, s.codeBy]);

  useEffect(() => {
    const on = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const regenerate = () => {
    act(() => api.regenerate(p.id, s.id, { instruction }), 'Đang dựng lại cảnh…');
    setInstruction('');
  };
  const saveCode = async () => {
    setSaving(true);
    try {
      const r = await api.saveCode(p.id, s.id, code);
      notify(r.issues.length ? `Đã lưu — còn ${r.issues.length} lưu ý` : 'Đã lưu & chạy thử OK');
      setVer(v => v + 1);
    } catch (e) { notify(e.message, true); }
    setSaving(false);
  };
  const busyHere = p.busy && /cảnh/.test(p.busy);
  const [byLabel, byCls] = s.codeBy ? byOf(s) : ['Chưa dựng', ''];

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <button className="btn ghost icon" disabled={index === 0} onClick={() => onNav(index - 1)}><ChevronLeft size={18} /></button>
          <h2>Cảnh {index + 1}</h2>
          <button className="btn ghost icon" disabled={index === p.scenes.length - 1} onClick={() => onNav(index + 1)}><ChevronRight size={18} /></button>
          <span className={`pill ${byCls}`}>{byLabel}</span>
          <span className="pill">{fmtTime(s.start)} · {s.duration?.toFixed(1)}s</span>
          <span className="hint grow" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{s.chapterTitle}</span>
          <button className="btn ghost icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {s.voiced ? (
            <iframe key={`${s.id}-${s.thumb}-${ver}`} className="player-frame" src={`/runtime/player.html?project=${p.id}&scene=${s.id}&autoplay=1&loop=1`} allow="autoplay; fullscreen" />
          ) : <div className="player-frame" style={{ display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>Cảnh chưa có giọng đọc</div>}

          {s.issues?.length > 0 && (
            <div className="banner warn" style={{ marginTop: 14 }}>
              <AlertTriangle size={18} color="var(--warn)" />
              <div className="grow"><b>Kiểm tra tự động còn lưu ý</b><ul className="issues">{s.issues.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            </div>
          )}

          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <label className="label">Lời thoại</label>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>{s.narration}</div>
            <label className="label" style={{ marginTop: 12 }}>Ý tưởng hình ảnh</label>
            <div className="muted">{s.visual}</div>
          </div>

          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <label className="label">Muốn cảnh này khác đi thế nào? (không bắt buộc)</label>
            <textarea className="textarea" rows={2} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="VD: cho cảnh ở chợ thay vì ngoài phố; thêm xe cộ chạy; máy quay đẩy vào bảng giá…" />
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn primary" disabled={!!p.busy} onClick={regenerate}>{busyHere ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />} Dựng lại</button>
              <button className="btn" disabled={!!p.busy} onClick={() => act(() => api.revoice(p.id, s.id), 'Đang đọc lại…')}><Mic size={15} /> Đọc lại giọng</button>
              <div className="grow" />
              <button className="btn ghost" onClick={() => setShowCode(!showCode)}><Code2 size={15} /> {showCode ? 'Ẩn mã' : 'Sửa mã'}</button>
            </div>
          </div>

          {showCode && full && (
            <div className="card" style={{ padding: 16, marginTop: 14 }}>
              <div className="between">
                <div className="code-tabs">{['html', 'css', 'js'].map(k => <button key={k} className={`chip ${codeTab === k ? 'on' : ''}`} style={{ height: 30 }} onClick={() => setCodeTab(k)}>{k.toUpperCase()}</button>)}</div>
                <button className="btn primary sm" disabled={saving} onClick={saveCode}>{saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Lưu & chạy thử</button>
              </div>
              <textarea className="code" spellCheck={false} value={code[codeTab]} onChange={e => setCode({ ...code, [codeTab]: e.target.value })} rows={20} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ScenesTab({ p, act }) {
  const [open, setOpen] = useState(null);
  if (!p.scenes.length) return <div className="empty">Chưa có cảnh nào — kịch bản cần được viết trước.</div>;
  const coded = p.scenes.filter(s => s.coded).length;
  const fallback = p.scenes.filter(s => s.codeBy === 'fallback').length;
  let lastChapter = null;
  return (
    <div className="fade-in">
      <div className="between" style={{ marginBottom: 16 }}>
        <div className="row">
          <h2>{coded}/{p.scenes.length} cảnh đã dựng</h2>
          {fallback > 0 && <span className="pill err">{fallback} cảnh dùng mẫu an toàn — nên dựng lại</span>}
        </div>
        <span className="hint">Bấm vào cảnh để xem động, yêu cầu AI sửa hoặc sửa mã.</span>
      </div>
      <div className="scene-grid">
        {p.scenes.map((s, i) => {
          const sep = s.chapterId !== lastChapter ? <div className="chapter-sep" key={'c' + s.id}>{s.chapterTitle}</div> : null;
          lastChapter = s.chapterId;
          const [byLabel, byCls] = byOf(s);
          return (
            <React.Fragment key={s.id}>
              {sep}
              <div className={`scard ${open === i ? 'sel' : ''}`} onClick={() => setOpen(i)}>
                <div className="th">
                  {s.thumb ? <img src={s.thumb} alt="" loading="lazy" /> : (p.stages.scenes.state === 'running' && !s.coded ? <Loader2 className="spin" size={22} /> : <ImageOff size={22} />)}
                  <div className="badges">
                    <span className="pill" style={{ background: 'rgba(0,0,0,.65)', color: '#fff' }}>{i + 1}</span>
                    {byLabel && <span className={`pill ${byCls}`}>{byLabel}</span>}
                    {s.issues?.length > 0 && s.codeBy !== 'fallback' && <span className="pill warn" title={s.issues.join('\n')}>{s.issues.length}</span>}
                    {!s.coded && s.codeBy && <span className="pill warn">cũ</span>}
                  </div>
                  {s.duration > 0 && <span className="dur">{s.duration.toFixed(1)}s</span>}
                </div>
                <div className="tx">{s.narration}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {open !== null && p.scenes[open] && <SceneDrawer p={p} index={open} onClose={() => setOpen(null)} onNav={setOpen} act={act} />}
    </div>
  );
}
