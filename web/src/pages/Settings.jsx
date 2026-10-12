import React, { useEffect, useState } from 'react';
import { Save, Eye, EyeOff } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

function Field({ label, hint, children, full }) {
  return <div className={full ? 'full' : ''}><label className="label">{label}</label>{children}{hint && <div className="hint" style={{ marginTop: 5 }}>{hint}</div>}</div>;
}

function Secret({ value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="row">
      <input className="input" type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} />
      <button className="btn icon" onClick={() => setShow(!show)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
    </div>
  );
}

export default function Settings() {
  const { meta, notify, reloadMeta } = useApp();
  const [s, setS] = useState(null);
  useEffect(() => { api.settings().then(setS); }, []);
  if (!s) return <div className="empty">Đang tải…</div>;
  const up = (sec, patch) => setS(x => ({ ...x, [sec]: { ...x[sec], ...patch } }));
  const save = async () => {
    try { setS(await api.saveSettings(s)); await reloadMeta(); notify('Đã lưu cài đặt'); }
    catch (e) { notify(e.message, true); }
  };

  return (
    <div className="page settings fade-in" style={{ maxWidth: 900 }}>
      <div className="between" style={{ marginBottom: 22 }}>
        <h1>Cài đặt</h1>
        <button className="btn primary" onClick={save}><Save size={15} /> Lưu</button>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Mô hình AI</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>Flash (rẻ) viết kịch bản, Luna dựng cảnh. Astra (đắt) chỉ dùng cho chỉ đạo mỹ thuật và vài hình minh họa chủ lực — số lượng tự quyết theo nội dung (0–6 hình mỗi video).</p>
        <div className="form-grid">
          <Field label="API endpoint (tương thích OpenAI)" full><input className="input" value={s.llm.baseUrl} onChange={e => up('llm', { baseUrl: e.target.value })} /></Field>
          <Field label="API key" full><Secret value={s.llm.apiKey} onChange={v => up('llm', { apiKey: v })} /></Field>
          <Field label="Model viết kịch bản (Flash)" hint="Dàn ý, lời thoại, biên tập, metadata YouTube"><input className="input" value={s.llm.flashModel} onChange={e => up('llm', { flashModel: e.target.value })} /></Field>
          <Field label="Model dựng cảnh (viết code)" hint="gpt-6-luna: mạnh và rẻ, nhưng chậm hơn"><input className="input" value={s.llm.coderModel} onChange={e => up('llm', { coderModel: e.target.value })} /></Field>
          <Field label="Model soát hình (phải đọc được ảnh)" hint="Xem khung hình thật để bắt lỗi bố cục"><input className="input" value={s.llm.visionModel} onChange={e => up('llm', { visionModel: e.target.value })} /></Field>
          <Field label="Model Astra (cao cấp)"><input className="input" value={s.llm.astraModel} onChange={e => up('llm', { astraModel: e.target.value })} /></Field>
          <Field label="Số lượt Flash chạy song song" hint="6–8 là hợp lý"><input className="input" type="number" min="1" max="16" value={s.llm.flashConcurrency} onChange={e => up('llm', { flashConcurrency: Number(e.target.value) })} /></Field>
          <Field label="Số cảnh dựng song song" hint="Model dựng cảnh chậm → tăng số này để nhanh hơn"><input className="input" type="number" min="1" max="16" value={s.llm.coderConcurrency} onChange={e => up('llm', { coderConcurrency: Number(e.target.value) })} /></Field>
          <Field label="Số lượt Astra chạy song song"><input className="input" type="number" min="1" max="4" value={s.llm.astraConcurrency} onChange={e => up('llm', { astraConcurrency: Number(e.target.value) })} /></Field>
          <Field label="Soát hình bằng AI">
            <span className={`toggle ${s.llm.visionReview !== false ? 'on' : ''}`} style={{ height: 42 }} onClick={() => up('llm', { visionReview: s.llm.visionReview === false })}><span className="sw" /> Xem khung hình thật của từng cảnh (~2 credit/cảnh)</span>
          </Field>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Giọng đọc</h2>
        <div className="form-grid">
          <Field label="API key ai33.pro (tuỳ chọn — giọng Vbee/ElevenLabs trả phí)" full hint="Để trống nếu chỉ dùng giọng Edge miễn phí."><Secret value={s.tts.ai33Key} onChange={v => up('tts', { ai33Key: v })} /></Field>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Xuất video</h2>
        <div className="form-grid">
          <Field label="Số luồng render song song" hint="Mỗi luồng là 1 tab Chrome. Máy mạnh: 4–6."><input className="input" type="number" min="1" max="8" value={s.render.workers} onChange={e => up('render', { workers: Number(e.target.value) })} /></Field>
          <Field label="Chất lượng (CRF — thấp hơn = nét hơn, file nặng hơn)"><input className="input" type="number" min="14" max="28" value={s.render.crf} onChange={e => up('render', { crf: Number(e.target.value) })} /></Field>
          <Field label="Tốc độ nén x264">
            <select className="select" value={s.render.preset} onChange={e => up('render', { preset: e.target.value })}>
              {['veryfast', 'faster', 'fast', 'medium', 'slow'].map(x => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Đường dẫn Chrome/Edge (để trống = tự tìm)"><input className="input" value={s.render.browserPath} onChange={e => up('render', { browserPath: e.target.value })} /></Field>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Mặc định cho video mới</h2>
        <div className="form-grid">
          <Field label="Giọng đọc">
            <select className="select" value={s.defaults.voice.voiceId} onChange={e => { const v = meta.voices.find(x => x.id === e.target.value); up('defaults', { voice: { ...s.defaults.voice, voiceId: v.id, engine: v.engine } }); }}>
              {meta.voices.map(v => <option key={v.id} value={v.id}>{v.name} · {v.gender}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}
