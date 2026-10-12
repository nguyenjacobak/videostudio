import React from 'react';
import { Copy, Download, Film, RefreshCw, Loader2, Subtitles } from 'lucide-react';
import { api, fmtTime } from '../api.js';
import { useApp } from '../App.jsx';

function CopyRow({ text, children }) {
  const { notify } = useApp();
  return (
    <div className="copy-row">
      <div className="grow">{children || text}</div>
      <button className="btn ghost sm icon" title="Sao chép" onClick={() => { navigator.clipboard.writeText(text); notify('Đã sao chép'); }}><Copy size={13} /></button>
    </div>
  );
}

export default function PublishTab({ p, act }) {
  const { notify } = useApp();
  const r = p.stages.render;
  const pr = r.progress;
  const pub = p.publish;
  const ready = p.stages.scenes.state === 'done';

  return (
    <div className="pub-grid fade-in">
      <div>
        <div className="card" style={{ padding: 18 }}>
          <div className="between" style={{ marginBottom: 12 }}>
            <h2>Video</h2>
            {p.render && <span className="hint">Xuất lúc {new Date(p.render.at).toLocaleString('vi-VN')} · mất {fmtTime(p.render.took)}</span>}
          </div>
          {r.state === 'running' ? (
            <div>
              <div className="row"><Loader2 size={16} className="spin" /><b>Đang xuất video…</b></div>
              <div className="render-progress"><i style={{ width: `${pr?.total ? (pr.done / pr.total) * 100 : 2}%` }} /></div>
              <div className="hint">{pr?.label || 'Chuẩn bị…'}</div>
            </div>
          ) : p.render ? (
            <>
              <video className="out" src={`/files/${p.id}/${p.render.file}?v=${p.render.at}`} controls preload="metadata" />
              <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <a className="btn primary" href={`/files/${p.id}/${p.render.file}`} download><Download size={15} /> Tải MP4 ({(p.render.size / 1048576).toFixed(0)} MB)</a>
                <a className="btn" href={`/files/${p.id}/${p.render.srt}`} download="phude.srt"><Subtitles size={15} /> Phụ đề .srt</a>
                <button className="btn" disabled={!!p.busy} onClick={() => act(() => api.render(p.id), 'Bắt đầu xuất lại')}><RefreshCw size={14} /> Xuất lại</button>
              </div>
            </>
          ) : (
            <div className="empty" style={{ padding: 30 }}>
              <Film size={30} />
              <p>{ready ? 'Mọi cảnh đã sẵn sàng.' : 'Cần dựng xong các cảnh trước khi xuất.'}</p>
              <button className="btn primary big" disabled={!ready || !!p.busy} onClick={() => act(() => api.render(p.id), 'Bắt đầu xuất video')}><Film size={17} /> Xuất video 1080p</button>
              {r.state === 'error' && <p style={{ color: 'var(--err)' }}>{r.error}</p>}
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="card" style={{ padding: 18 }}>
          <div className="between" style={{ marginBottom: 12 }}>
            <h2>Đăng YouTube</h2>
            <button className="btn sm" disabled={!!p.busy || !ready} onClick={() => act(() => api.publish(p.id), 'Flash đang viết lại tiêu đề & mô tả…')}><RefreshCw size={13} /> Tạo lại</button>
          </div>
          {!pub ? <div className="muted">Tiêu đề, mô tả và thẻ sẽ được tạo tự động sau khi dựng cảnh xong.</div> : (
            <>
              <label className="label">Tiêu đề gợi ý</label>
              {pub.titles.map((t, i) => <CopyRow key={i} text={t} />)}
              <label className="label" style={{ marginTop: 14 }}>Mô tả (đã kèm mốc chương)</label>
              <textarea className="textarea" rows={10} readOnly value={pub.description} />
              <button className="btn sm" style={{ marginTop: 6 }} onClick={() => { navigator.clipboard.writeText(pub.description); notify('Đã sao chép mô tả'); }}><Copy size={13} /> Sao chép mô tả</button>
              <label className="label" style={{ marginTop: 14 }}>Thẻ</label>
              <CopyRow text={pub.tags.join(', ')}><span style={{ fontWeight: 500, fontSize: 13 }}>{pub.tags.join(', ')}</span></CopyRow>
              {pub.thumbnailText?.length > 0 && <>
                <label className="label" style={{ marginTop: 14 }}>Chữ cho thumbnail</label>
                {pub.thumbnailText.map((t, i) => <CopyRow key={i} text={t} />)}
              </>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
