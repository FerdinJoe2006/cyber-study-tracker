/* =====================================================================
   STUDY TRACKER - ui_app.js   App shell: tabs, shortcuts, mount
   ===================================================================== */
function App() {
  useApp(); const tab = useTab();
  /* desktop keyboard shortcuts: S start/stop timer, C complete today, N new note */
  useEffect(() => {
    const f = (e) => {
      if (S.verifyReq || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); timerState() ? timerStop(false) : timerStart(); }
      else if (k === 'c') { if (planFor(today())) { e.preventDefault(); completeDay(today()); } }
      else if (k === 'n') { e.preventDefault(); goTab('today'); setTimeout(() => { const a = document.getElementById('note-area'); if (a) a.focus(); }, 80); }
    };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }, []);
  if (S.error) return html`<div className="tile fatal col"><h2>Storage is not available</h2><p className="muted">${S.error}</p><p className="small muted">This app saves everything in your browser's IndexedDB. Private browsing windows, blocked site data or a full disk can stop it. Try a normal window, allow site data for this page, then reload.</p><button className="btn primary" style=${{ alignSelf: 'flex-start' }} onClick=${() => location.reload()}>Reload</button></div>`;
  if (!S.ready) return html`<div className="fatal"><p className="muted">Loading your plan…</p></div>`;
  const page = { today: TodayPage, plan: PlanPage, quiz: QuizPage, dashboard: DashboardPage, rewards: RewardsPage, certs: CertsPage, settings: SettingsPage }[tab];
  const nav = (cls) => TABS.map(([k, label, short, icon]) => html`<button key=${k} className="tab" aria-current=${tab === k ? 'page' : undefined} onClick=${() => goTab(k)} aria-label=${label}><${Icon} n=${icon} /><span>${cls === 'side' ? label : short}</span></button>`);
  return html`<div className="app"><a href="#main" className="skip" onClick=${(e) => { e.preventDefault(); document.getElementById('main').focus(); }}>Skip to content</a>
    <nav className="side" aria-label="Main"><div className="brand"><img src="icons/icon-192.png" alt="" />Cyber Study</div>${nav('side')}
      <div className="keys"><div><span className="kbd">S</span> start / stop</div><div><span className="kbd">C</span> complete</div><div><span className="kbd">N</span> new note</div></div></nav>
    <main id="main" tabIndex="-1" className="main" style=${{ outline: 'none' }}><${page} /></main>
    <nav className="tabbar" aria-label="Main">${nav('bar')}</nav><${Toasts} /><${VerifyHost} /><${Celebration} /></div>`;
}
ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
boot();
