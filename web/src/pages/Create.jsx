import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Play, Square, ChevronDown, ChevronRight, Upload, ClipboardCheck, Zap, FileText } from 'lucide-react';
import { api } from '../api.js';
import { useApp, go } from '../App.jsx';

const EXAMPLES = [
  'Vì sao lạm phát khiến tiền của bạn mất giá?',
  'Lỗ đen hình thành như thế nào và điều gì xảy ra nếu rơi vào đó?',
  'Tại sao Nhật Bản rơi vào "thập kỷ mất mát"?',
  'Chiến tranh thương mại Mỹ – Trung ảnh hưởng gì tới Việt Nam?',
  'mRNA vaccine hoạt động ra sao?',
  'Vì sao Singapore từ làng chài trở thành cường quốc kinh tế?',
];

export function StyleMock({ tokens }) {
  return (
    <div className="mock" style={{ background: `linear-gradient(160deg, ${tokens.bg}, ${tokens.bg2})`, color: tokens.text }}>
      <div className="dot" style={{ background: `radial-gradient(circle at 35% 35%, ${tokens.accent}, ${tokens.primary})` }} />
      <div className="t" style={{ fontFamily: tokens.fontDisplay }}>Tiêu đề cảnh</div>
      <div className="bars">
        {[0.45, 0.7, 1, 0.6].map((h, i) => <i key={i} style={{ height: `${h * 100}%`, background: i === 2 ? tokens.accent : tokens.primary }} />)}
      </div>
    </div>
  );
}

export function VoicePicker({ voices, value, onChange }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const cur = voices.find(v => v.id === value.voiceId) || voices[0];
  const toggle = () => {
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    const a = new Audio(`/api/voices/preview?engine=${cur.engine}&voiceId=${encodeURIComponent(cur.id)}&rate=${value.rate || 0}`);
    audio.current = a;
    a.onended = () => setPlaying(false);
    a.onerror = () => setPlaying(false);
    a.play();
    setPlaying(true);
  };
  return (
    <div className="opt-grid">
      <div>
        <label className="label">Giọng đọc</label>
        <div className="row">
          <select className="select" value={cur?.id} onChange={e => { const v = voices.find(x => x.id === e.target.value); onChange({ ...value, voiceId: v.id, engine: v.engine }); }}>
            {voices.map(v => <option key={v.id} value={v.id}>{v.name} · {v.gender}{v.engine === 'ai33' ? ' · ai33' : ' · miễn phí'}</option>)}
          </select>
          <button className="btn icon" onClick={toggle} title="Nghe thử">{playing ? <Square size={14} /> : <Play size={15} />}</button>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>{cur?.note}</div>
      </div>
      <div>
        <label className="label">Tốc độ đọc: {value.rate > 0 ? '+' : ''}{value.rate || 0}%</label>
        <input type="range" min="-20" max="25" step="5" value={value.rate || 0} onChange={e => onChange({ ...value, rate: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--brand)' }} />
        <div className="hint">Video kiến thức thường hợp với 0% đến +10%.</div>
      </div>
    </div>
  );
}

export default function Create() {
  const { meta, notify, reloadMeta } = useApp();
  const [f, setF] = useState({
    topic: '', script: '', category: 'science', tone: 'story', mode: 'auto',
    voice: { engine: 'ai33', voiceId: 'vbee_hn_male_minhquan_yt-stable', rate: 0 }, captions: true, audience: '', notes: '', sources: '', music: '',
  });
  const [input, setInput] = useState('topic'); // 'topic' = AI writes; 'script' = user's own script, read verbatim
  const [adv, setAdv] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = patch => setF(x => ({ ...x, ...patch }));

  useEffect(() => {
    api.settings().then(s => set({ voice: s.defaults.voice, captions: s.defaults.captions }));
  }, []);

  // Same estimate as the server: ai33/Vbee voices read ≈ 225 words/min, Edge ≈ 175, scaled by the rate slider.
  const wpm = (f.voice.engine === 'ai33' ? 225 : meta.wordsPerMinute) * (1 + (f.voice.rate || 0) / 100);
  const scriptWords = f.script.trim() ? f.script.trim().split(/\s+/).length : 0;
  const ready = input === 'topic' ? !!f.topic.trim() : scriptWords >= 30;

  const submit = async () => {
    if (!ready) return notify(input === 'topic' ? 'Hãy nhập chủ đề video' : 'Hãy dán kịch bản (ít nhất vài câu)', true);
    setBusy(true);
    try {
      const p = await api.create(input === 'topic' ? { ...f, script: '' } : f);
      go(`p/${p.id}`);
    } catch (e) { notify(e.message, true); setBusy(false); }
  };

  const uploadMusic = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = await api.uploadMusic(file);
    await reloadMeta();
    set({ music: r.name });
  };

  return (
    <div className="page create fade-in">
      <h1 style={{ marginBottom: 6 }}>Tạo video mới</h1>
      <p className="muted" style={{ margin: '0 0 24px' }}>Nhập chủ đề hoặc dán kịch bản của bạn — độ dài video tự động theo nội dung.</p>

      <div className="card section">
        <div className="head"><span className="num">1</span><h2>Nội dung video</h2></div>
        <div className="opt-grid" style={{ marginBottom: 16 }}>
          <button className={`mode ${input === 'topic' ? 'on' : ''}`} onClick={() => { setInput('topic'); if (f.category === 'auto') set({ category: 'science' }); }}>
            <b><Sparkles size={17} /> AI viết từ chủ đề</b>
            <p>Bạn nhập chủ đề (và tài liệu tham khảo nếu có). AI tự chọn độ dài hợp với lượng kiến thức cần giải thích.</p>
          </button>
          <button className={`mode ${input === 'script' ? 'on' : ''}`} onClick={() => { setInput('script'); set({ category: 'auto' }); }}>
            <b><FileText size={17} /> Dùng kịch bản của tôi</b>
            <p>Dán kịch bản bạn đã viết — giữ nguyên từng chữ. AI chỉ chia cảnh, chia chương và minh họa. Độ dài theo kịch bản.</p>
          </button>
        </div>

        {input === 'topic' ? (
          <>
            <textarea className="textarea topic-input" autoFocus placeholder="Ví dụ: Vì sao giá nhà ở Việt Nam tăng nhanh hơn thu nhập?" value={f.topic} onChange={e => set({ topic: e.target.value })} />
            <div className="examples">{EXAMPLES.map(x => <button key={x} onClick={() => set({ topic: x })}>{x}</button>)}</div>
          </>
        ) : (
          <>
            <textarea className="textarea script-input" autoFocus rows={14} value={f.script} onChange={e => set({ script: e.target.value })}
              placeholder={'Dán kịch bản vào đây…\n\n## Phần 1: Lãi suất là gì\nLãi suất là giá của tiền. Khi bạn vay ngân hàng…\n\n[Hình: ngân hàng đưa tiền cho người mua nhà]\nNếu lãi suất tăng, khoản trả góp hàng tháng…'} />
            <div className="between hint" style={{ marginTop: 8 }}>
              <span>Mẹo: dòng tiêu đề (<code>## Phần 2…</code>, <code>Chương 3: …</code>) thành chương; dòng <code>[Hình: …]</code> là gợi ý minh họa cho đoạn sau.</span>
              <b style={{ whiteSpace: 'nowrap', marginLeft: 12 }}>{scriptWords.toLocaleString('vi-VN')} từ · ≈ {(scriptWords / wpm).toFixed(1)} phút</b>
            </div>
            <input className="input" style={{ marginTop: 12 }} value={f.topic} onChange={e => set({ topic: e.target.value })} placeholder="Tên/chủ đề video (không bắt buộc — AI tự đặt tiêu đề)" />
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <label className="label">Tài liệu tham khảo <span className="hint">(không bắt buộc — dán bài báo, số liệu, ghi chú; AI ưu tiên dùng để {input === 'topic' ? 'viết' : 'minh họa'} chính xác)</span></label>
          <textarea className="textarea" rows={input === 'topic' ? 5 : 3} value={f.sources} onChange={e => set({ sources: e.target.value })} placeholder="Dán nội dung tham khảo tại đây…" />
        </div>

        <div style={{ marginTop: 20 }} className="opt-grid">
          <div>
            <label className="label">Lĩnh vực</label>
            <div className="chips">
              {input === 'script' && <button className={`chip ${f.category === 'auto' ? 'on' : ''}`} onClick={() => set({ category: 'auto' })}>Tự nhận diện</button>}
              {Object.entries(meta.categories).map(([k, v]) => <button key={k} className={`chip ${f.category === k ? 'on' : ''}`} onClick={() => set({ category: k })}>{v}</button>)}
            </div>
          </div>
          {input === 'topic' && (
            <div>
              <label className="label">Cách kể</label>
              <div className="chips">{Object.entries({ story: 'Kể chuyện', explainer: 'Giải thích', analysis: 'Phân tích sâu', casual: 'Gần gũi' }).map(([k, v]) => <button key={k} className={`chip ${f.tone === k ? 'on' : ''}`} title={meta.tones[k]} onClick={() => set({ tone: k })}>{v}</button>)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="card section">
        <div className="head"><span className="num">2</span><h2>Giọng đọc</h2></div>
        <VoicePicker voices={meta.voices} value={f.voice} onChange={voice => set({ voice })} />
      </div>

      <div className="card section">
        <div className="head"><span className="num">3</span><h2>Quy trình</h2></div>
        <div className="opt-grid">
          <button className={`mode ${f.mode === 'auto' ? 'on' : ''}`} onClick={() => set({ mode: 'auto' })}>
            <b><Zap size={17} /> Tự động hoàn toàn <span className="pill brand">Mặc định</span></b>
            <p>Chạy một mạch từ chủ đề đến file MP4: tự duyệt kịch bản, cảnh nào lỗi tự làm lại, API lỗi tự gọi lại. Bạn vẫn có thể chỉnh từng cảnh và xuất lại sau.</p>
          </button>
          <button className={`mode ${f.mode === 'review' ? 'on' : ''}`} onClick={() => set({ mode: 'review' })}>
            <b><ClipboardCheck size={17} /> Duyệt kịch bản trước</b>
            <p>AI viết kịch bản rồi dừng để bạn đọc & sửa. Sau khi duyệt mới lồng tiếng và dựng cảnh.</p>
          </button>
        </div>
      </div>

      <div className="card section">
        <button className="row btn ghost" style={{ padding: 0, height: 'auto' }} onClick={() => setAdv(!adv)}>
          {adv ? <ChevronDown size={17} /> : <ChevronRight size={17} />}<h2>Tuỳ chọn nâng cao</h2><span className="hint">khán giả, phụ đề, nhạc nền</span>
        </button>
        {adv && (
          <div className="form-grid" style={{ marginTop: 18 }}>
            <div>
              <label className="label">Khán giả mục tiêu</label>
              <input className="input" value={f.audience} onChange={e => set({ audience: e.target.value })} placeholder="Người xem phổ thông, tò mò…" />
            </div>
            <div>
              <label className="label">Yêu cầu thêm cho biên kịch</label>
              <input className="input" value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="VD: nhấn mạnh góc nhìn Việt Nam" />
            </div>
            <div>
              <label className="label">Nhạc nền (tự giảm âm lượng khi có lời đọc)</label>
              <div className="row">
                <select className="select" value={f.music} onChange={e => set({ music: e.target.value })}>
                  <option value="">Không dùng nhạc nền</option>
                  {meta.music.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <label className="btn icon" title="Tải nhạc lên"><Upload size={15} /><input type="file" accept="audio/*" hidden onChange={uploadMusic} /></label>
              </div>
            </div>
            <div className="full">
              <span className={`toggle ${f.captions ? 'on' : ''}`} onClick={() => set({ captions: !f.captions })}><span className="sw" /> Hiện phụ đề karaoke trong video</span>
            </div>
          </div>
        )}
      </div>

      <div className="submit-bar">
        <span className="hint">{f.mode === 'review' ? (input === 'script' ? 'Cảnh & hình minh họa sẽ sẵn sàng để duyệt sau khoảng 1 phút.' : 'Kịch bản sẽ sẵn sàng sau khoảng 1–2 phút.') : 'Toàn bộ quy trình mất khoảng 15–30 phút tuỳ độ dài.'}</span>
        <button className="btn primary big" disabled={busy || !ready} onClick={submit}><Sparkles size={18} /> {busy ? 'Đang tạo…' : 'Bắt đầu tạo video'}</button>
      </div>
    </div>
  );
}
