import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FileText, Mic, Palette, Clapperboard, Film, Check, Loader2, AlertTriangle, Circle, Square, Play, Download, RefreshCw, ArrowLeft, ClipboardCheck, Settings2, MonitorPlay, Share2, LayoutGrid } from 'lucide-react';
import { api, fmtTime } from '../api.js';
import { useApp, go } from '../App.jsx';
import { STATUS } from './Home.jsx';
import ScriptTab from '../components/ScriptTab.jsx';
import ScenesTab from '../components/ScenesTab.jsx';
import PreviewTab from '../components/PreviewTab.jsx';
import PublishTab from '../components/PublishTab.jsx';
import ProjectSettings from '../components/ProjectSettings.jsx';

const STEPS = [
  { key: 'script', name: 'Kịch bản', icon: FileText, who: 'Flash' },
  { key: 'voice', name: 'Giọng đọc', icon: Mic, who: 'TTS' },
  { key: 'art', name: 'Ảnh minh họa', icon: Palette, who: 'AI vẽ' },
  { key: 'scenes', name: 'Dựng cảnh', icon: Clapperboard, who: 'Flash' },
  { key: 'render', name: 'Xuất video', icon: Film, who: 'Chrome + FFmpeg' },
];

function Stepper({ p }) {
  return (
    <div className="stepper">
      {STEPS.map(s => {
        const st = p.stages[s.key] || {};
        const state = st.state || 'pending';
        const pr = st.progress;
        const Icon = state === 'done' ? Check : state === 'running' || state === 'retrying' ? Loader2 : state === 'error' ? AlertTriangle : s.icon;
        let sub = { pending: 'Chưa chạy', running: 'Đang chạy…', done: 'Hoàn tất', error: st.error || 'Lỗi' }[state];
        if (state === 'running' && pr) sub = `${pr.label} · ${pr.done}/${pr.total}`;
        if (state === 'retrying') sub = 'Lỗi tạm thời — đang tự chạy lại';
        if (s.key === 'art' && state === 'done') sub = p.images?.length ? `${p.images.filter(i => i.status === 'done').length} hình (${p.images.filter(i => i.reused).length} dùng lại)` : 'Hình vector sẵn có';
        if (s.key === 'render' && state === 'pending' && p.status === 'ready') sub = 'Sẵn sàng';
        return (
          <div key={s.key} className={`step ${state}`} title={st.error || ''}>
            <div className="top"><span className="ico"><Icon size={13} className={state === 'running' || state === 'retrying' ? 'spin' : ''} /></span>{s.name}</div>
            <div className="sub">{sub}</div>
            {state === 'running' && pr?.total > 0 && <div className="bar" style={{ width: `${(pr.done / pr.total) * 100}%` }} />}
          </div>
        );
      })}
    </div>
  );
}

function Side({ p, logs }) {
  const box = useRef(null);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [logs.length]);
  const ROLES = [['flash', 'Kịch bản'], ['coder', 'Dựng cảnh'], ['vision', 'Soát hình AI'], ['astra', 'Astra']];
  const total = Object.values(p.cost).reduce((s, c) => s + (c.credits || 0), 0);
  return (
    <aside className="side">
      <div className="side-sec">
        <div className="between" style={{ marginBottom: 10 }}><h3>Chi phí AI</h3><span className="hint">tổng {Math.round(total).toLocaleString('vi-VN')} credit</span></div>
        <div className="cost">
          {ROLES.filter(([k]) => k === 'astra' || p.cost[k]?.calls).map(([k, label]) => {
            const c = p.cost[k] || { calls: 0, credits: 0, tokensOut: 0 };
            return (
              <div key={k} className={`box ${k === 'astra' ? 'astra' : ''}`}>
                <div className="k">{label}</div>
                <div className="v">{Math.round(c.credits).toLocaleString('vi-VN')}</div>
                <div className="s">{k === 'astra' ? `${c.calls} lượt · tự quyết theo nội dung` : `${c.calls} lượt · ${(c.tokensOut / 1000).toFixed(0)}k token ra`}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="side-sec" style={{ paddingBottom: 8 }}><h3>Nhật ký</h3></div>
      <div className="log" ref={box}>
        {logs.length === 0 && <div className="muted">Chưa có hoạt động.</div>}
        {logs.map((e, i) => (
          <div key={i} className={`e ${e.level}`}>
            <span className="t">{new Date(e.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>{e.message}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function Workspace({ id }) {
  const { notify } = useApp();
  const [p, setP] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState(null);
  const [err, setErr] = useState(null);
  const timer = useRef(null);

  const load = useCallback(() => api.project(id).then(setP).catch(e => setErr(e.message)), [id]);
  const refresh = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; load(); }, 700);
  }, [load]);

  useEffect(() => {
    load();
    api.log(id).then(setLogs).catch(() => {});
    const es = new EventSource(`/api/projects/${id}/events`);
    es.addEventListener('changed', refresh);
    es.addEventListener('job', refresh);
    es.addEventListener('log', e => setLogs(l => [...l.slice(-400), JSON.parse(e.data)]));
    es.addEventListener('progress', e => {
      const d = JSON.parse(e.data);
      setP(prev => prev && ({ ...prev, stages: { ...prev.stages, [d.stage]: { ...prev.stages[d.stage], progress: d } } }));
    });
    return () => { es.close(); clearTimeout(timer.current); };
  }, [id]);

  // Pick a sensible default tab once the project is known.
  useEffect(() => {
    if (!p || tab) return;
    if (p.status === 'done' || p.render) setTab('publish');
    else if (p.stages.scenes.state === 'done' || p.stages.scenes.state === 'running') setTab('scenes');
    else setTab('script');
  }, [p, tab]);

  const act = async (fn, okMsg) => {
    try { const r = await fn(); if (r?.id) setP(r); if (okMsg) notify(okMsg); refresh(); }
    catch (e) { notify(e.message, true); }
  };

  if (err) return <div className="page"><div className="banner err"><AlertTriangle /><div className="grow"><b>Không mở được dự án</b><span>{err}</span></div><button className="btn" onClick={() => go('')}>Về danh sách</button></div></div>;
  if (!p) return <div className="empty">Đang tải dự án…</div>;

  const [statusLabel, statusCls] = STATUS[p.status] || STATUS.draft;
  const produced = p.stages.scenes.state === 'done' || p.scenes.some(s => s.coded);
  const stale = p.scenes.filter(s => (p.stages.voice.state !== 'pending' && !s.voiced) || (produced && !s.coded)).length || (p.masterStale ? 1 : 0);

  let primary;
  if (p.busy) primary = <button className="btn danger" onClick={() => act(() => api.cancel(id), 'Đã gửi lệnh dừng')}><Square size={14} /> Dừng</button>;
  else if (p.status === 'awaiting_review') primary = <button className="btn primary" onClick={() => act(() => api.approve(id), 'Bắt đầu lồng tiếng & dựng cảnh')}><ClipboardCheck size={16} /> Duyệt kịch bản & dựng video</button>;
  else if (p.stages.script.state !== 'done' || Object.values(p.stages).some(s => s.state === 'error') || stale) primary = <button className="btn primary" onClick={() => act(() => api.run(id))}><Play size={15} /> {stale ? `Cập nhật ${stale} cảnh đã sửa` : 'Tiếp tục'}</button>;
  else if (!p.render) primary = <button className="btn primary" onClick={() => act(() => api.render(id), 'Bắt đầu xuất video')}><Film size={16} /> Xuất video</button>;
  else primary = (
    <>
      <button className="btn" onClick={() => act(() => api.render(id), 'Bắt đầu xuất lại')}><RefreshCw size={14} /> Xuất lại</button>
      <a className="btn primary" href={`/files/${id}/${p.render.file}`} download><Download size={15} /> Tải MP4</a>
    </>
  );

  const TABS = [
    { key: 'script', name: 'Kịch bản', icon: FileText, n: p.scenes.length || null },
    { key: 'scenes', name: 'Cảnh quay', icon: LayoutGrid, n: p.scenes.filter(s => s.coded).length || null },
    { key: 'preview', name: 'Xem trước', icon: MonitorPlay },
    { key: 'publish', name: 'Xuất bản', icon: Share2 },
    { key: 'settings', name: 'Thiết lập', icon: Settings2 },
  ];

  return (
    <div className="ws">
      <div>
        <div className="ws-head">
          <button className="btn ghost icon" onClick={() => go('')} title="Về danh sách"><ArrowLeft size={18} /></button>
          <input className="title-input" defaultValue={p.title} key={p.title} onBlur={e => e.target.value.trim() && e.target.value !== p.title && act(() => api.update(id, { title: e.target.value.trim() }))} />
          <span className={`pill ${statusCls}`}>{p.busy && <Loader2 size={12} className="spin" />}{p.busy || statusLabel}</span>
          {p.masterAudio && <span className="pill">{fmtTime(p.masterAudio.duration)}</span>}
          {primary}
        </div>
        <Stepper p={p} />
      </div>
      <div className="ws-body">
        <div className="ws-main">
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                <t.icon size={15} />{t.name}{t.n ? <span className="n">{t.n}</span> : null}
              </button>
            ))}
          </div>
          <div className="tab-body">
            {tab === 'script' && <ScriptTab p={p} act={act} setP={setP} />}
            {tab === 'scenes' && <ScenesTab p={p} act={act} />}
            {tab === 'preview' && <PreviewTab p={p} />}
            {tab === 'publish' && <PublishTab p={p} act={act} />}
            {tab === 'settings' && <ProjectSettings p={p} act={act} />}
          </div>
        </div>
        <Side p={p} logs={logs} />
      </div>
    </div>
  );
}
