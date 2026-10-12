import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fmtTime } from '../api.js';

export default function PreviewTab({ p }) {
  const frame = useRef(null);
  const [ver, setVer] = useState(0);
  if (!p.masterAudio) return <div className="empty">Cần hoàn tất giọng đọc trước khi xem trước.</div>;
  const chapters = (p.outline?.chapters || []).map(ch => ({ ch, s: p.scenes.find(s => s.chapterId === ch.id) })).filter(x => x.s);
  const seek = t => frame.current?.contentWindow?.postMessage({ type: 'rt-seek', t, play: true }, '*');
  const missing = p.scenes.filter(s => !s.coded).length;
  return (
    <div className="preview-wrap fade-in">
      <div className="between" style={{ marginBottom: 12 }}>
        <div className="row"><h2>Xem trước toàn bộ</h2><span className="pill">{fmtTime(p.masterAudio.duration)}</span>{missing > 0 && <span className="pill warn">{missing} cảnh chưa dựng hiển thị mẫu tạm</span>}</div>
        <button className="btn sm" onClick={() => setVer(v => v + 1)}><RefreshCw size={13} /> Tải lại</button>
      </div>
      <iframe ref={frame} key={ver} className="player-frame" src={`/runtime/player.html?project=${p.id}`} allow="autoplay; fullscreen" />
      <p className="hint">Phím tắt: Space phát/dừng · ← → tua 5 giây · F toàn màn hình. Bản xem trước giống hệt video xuất ra.</p>
      <div className="chap-list">
        {chapters.map(({ ch, s }, i) => (
          <button key={ch.id} onClick={() => seek(s.start)}><span>{fmtTime(s.start)} · Phần {i + 1}</span>{ch.title}</button>
        ))}
      </div>
    </div>
  );
}
