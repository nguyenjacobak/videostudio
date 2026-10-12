import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Clapperboard, FolderKanban, Settings as SettingsIcon, Plus, Library as LibraryIcon } from 'lucide-react';
import { api } from './api.js';
import Home from './pages/Home.jsx';
import Create from './pages/Create.jsx';
import Workspace from './pages/Workspace.jsx';
import Settings from './pages/Settings.jsx';
import Library from './pages/Library.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function useHashRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || '';
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = path => { window.location.hash = '/' + path; };

export default function App() {
  const route = useHashRoute();
  const [meta, setMeta] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { api.meta().then(setMeta).catch(e => setToast({ msg: e.message, err: true })); }, []);

  const notify = useCallback((msg, err = false) => {
    setToast({ msg, err });
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => setToast(null), err ? 6000 : 3000);
  }, []);

  const [section, id] = route.split('/');
  let page;
  if (section === 'new') page = <Create />;
  else if (section === 'p' && id) page = <Workspace key={id} id={id} />;
  else if (section === 'settings') page = <Settings />;
  else if (section === 'library') page = <Library />;
  else page = <Home />;

  return (
    <Ctx.Provider value={{ meta, notify, reloadMeta: () => api.meta().then(setMeta) }}>
      <div className="shell">
        <nav className="rail">
          <a className="logo" href="#/" title="Video Studio"><Clapperboard size={20} color="#fff" /></a>
          <a href="#/" className={!section || section === 'p' ? 'on' : ''} title="Dự án"><FolderKanban size={21} /></a>
          <a href="#/new" className={section === 'new' ? 'on' : ''} title="Tạo video mới"><Plus size={22} /></a>
          <a href="#/library" className={section === 'library' ? 'on' : ''} title="Thư viện hình & nhân vật"><LibraryIcon size={20} /></a>
          <div className="spacer" />
          <a href="#/settings" className={section === 'settings' ? 'on' : ''} title="Cài đặt"><SettingsIcon size={20} /></a>
        </nav>
        <main className="main">{meta ? page : <div className="empty">Đang tải…</div>}</main>
      </div>
      {toast && <div className={`toast fade-in ${toast.err ? 'err' : ''}`}>{toast.msg}</div>}
    </Ctx.Provider>
  );
}
