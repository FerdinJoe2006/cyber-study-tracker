/* =====================================================================
   STUDY TRACKER - ui_common.js
   React helpers (htm = JSX without a build step), icons, shared widgets.
   ===================================================================== */
const { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } = React;
const html = htm.bind(React.createElement);
const useApp = () => useSyncExternalStore(subscribe, getVersion);

/* ---------- icons: one stroke width (1.9), drawn as inline SVG ---------- */
const ICONS = {
  today: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  plan: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  quiz: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  dash: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  rewards: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
  certs: 'M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM15.5 13l1.5 9-5-3-5 3 1.5-9',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z',
  coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4',
  play: 'M6 4l14 8-14 8V4Z', pause: 'M7 4h3v16H7zM14 4h3v16h-3z', stop: 'M6 6h12v12H6z',
  check: 'M20 6 9 17l-5-5', plus: 'M12 5v14M5 12h14', x: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6',
  skip: 'M5 4l10 8-10 8V4ZM19 5v14',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16', upload: 'M12 15V3m0 0L8 7m4-4 4 4M4 21h16',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1L12 2Z',
  shift: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  note: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
  swap: 'M7 7h12l-3-3M17 17H5l3 3', feed: 'M12 5v14m0 0-6-6m6 6 6-6',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  quizc: 'M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.1-1.5 2.4M12 18h.01',
  rest: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z',
};
function Icon({ n, size, className }) {
  return html`<svg width=${size || 18} height=${size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className=${className}><path d=${ICONS[n]} /></svg>`;
}

/* ---------- motion hooks (ported from the dashboard reference) ---------- */
function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)'); const u = () => setR(mq.matches); u();
    mq.addEventListener('change', u); return () => mq.removeEventListener('change', u);
  }, []);
  return r;
}
function useMounted() { const [on, setOn] = useState(false); useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []); return on; }
function useCountUp(target, enabled, duration = 1300) {
  const [v, setV] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) return setV(target);
    let raf = 0; const t0 = performance.now();
    const tick = (now) => { const p = Math.min(1, (now - t0) / duration); setV(target * (1 - Math.pow(1 - p, 4))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);
  return v;
}
/* re-render every second while a timer is running */
function useTick(active) { const [, f] = useState(0); useEffect(() => { if (!active) return; const id = setInterval(() => f((x) => x + 1), 1000); return () => clearInterval(id); }, [active]); }

/* ---------- widgets ---------- */
function Tile({ title, action, className, style, children, accent }) {
  return html`<section className=${'tile ' + (accent ? 'accent ' : '') + (className || '')} style=${style}>
    ${(title || action) && html`<header>${title && html`<h3>${title}</h3>`}${action}</header>`}${children}</section>`;
}
function Pills({ value, options, onChange, label }) {
  return html`<div role="radiogroup" aria-label=${label} className="pillsbar">${options.map((o) =>
    html`<button key=${o} type="button" role="radio" aria-checked=${o === value} onClick=${() => onChange(o)}>${o}</button>`)}</div>`;
}
function SubTabs({ value, options, onChange }) {
  return html`<div className="subtabs" role="tablist">${options.map(([k, label]) =>
    html`<button key=${k} role="tab" aria-selected=${k === value} onClick=${() => onChange(k)}>${label}</button>`)}</div>`;
}
const typeChip = (t) => html`<span className=${'chip ' + (t === 'lab' || t === 'project' ? 'amber' : t === 'exam' ? 'lilac' : '')}>${t}</span>`;
const statusLabel = { todo: 'Not started', doing: 'In progress', done: 'Done', skipped: 'Skipped', missed: 'Missed' };
const StatusDot = ({ st }) => html`<span className=${'status-dot st-' + st} title=${statusLabel[st]} role="img" aria-label=${statusLabel[st]}></span>`;
function Empty({ children }) { return html`<div className="empty">${children}</div>`; }

/* an in-app confirm dialog (the browser confirm() box blocks the page, so we avoid it) */
function Confirm({ title, body, yes, onYes, onNo }) {
  return html`<div className="scrim" role="dialog" aria-modal="true" aria-label=${title} onClick=${onNo}>
    <div className="modal col" onClick=${(e) => e.stopPropagation()}>
      <h2>${title}</h2><p className="muted">${body}</p>
      <div className="row between"><button className="btn ghost" onClick=${onNo}>Cancel</button><button className="btn primary" autoFocus onClick=${onYes}>${yes || 'Confirm'}</button></div>
    </div></div>`;
}
function useConfirm() {
  const [c, setC] = useState(null);
  const ask = (title, body, yes, fn) => setC({ title, body, yes, fn });
  const node = c && html`<${Confirm} title=${c.title} body=${c.body} yes=${c.yes} onNo=${() => setC(null)} onYes=${() => { const f = c.fn; setC(null); f(); }} />`;
  return [ask, node];
}

/* tiny, safe markdown renderer: escapes HTML first, then headings, bold, italic, code, links, lists */
function mdToHtml(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const out = []; let list = false, code = false;
  for (const line of src.split('\n')) {
    if (line.trim().startsWith('```')) { out.push(code ? '</pre>' : '<pre>'); code = !code; continue; }
    if (code) { out.push(esc(line) + '\n'); continue; }
    const li = line.match(/^\s*[-*] (.*)/);
    if (li) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(li[1]) + '</li>'); continue; }
    if (list) { out.push('</ul>'); list = false; }
    const h = line.match(/^(#{1,3}) (.*)/);
    if (h) out.push('<h4>' + inline(h[2]) + '</h4>'); else if (line.trim()) out.push('<p>' + inline(line) + '</p>');
  }
  if (list) out.push('</ul>'); if (code) out.push('</pre>');
  return out.join('');
}
function Markdown({ text }) { return html`<div className="md" dangerouslySetInnerHTML=${{ __html: mdToHtml(text || '') }}></div>`; }

/* confetti: a small canvas burst; skipped (static card only) when reduced motion is on */
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = ref.current, x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = ['#f5b041', '#a78bfa', '#6ee7b7', '#fde68a', '#c4b5fd'];
    const ps = Array.from({ length: 110 }, () => ({ x: c.width / 2, y: c.height * 0.4, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 3, r: Math.random() * 6 + 3, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6 }));
    let raf, f = 0;
    const tick = () => { x.clearRect(0, 0, c.width, c.height); ps.forEach((p) => { p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.a += 0.15; x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - f / 120); x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }); if (++f < 120) raf = requestAnimationFrame(tick); else x.clearRect(0, 0, c.width, c.height); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  return html`<canvas ref=${ref} className="confetti" aria-hidden="true"></canvas>`;
}
function Celebration() {
  const c = S.celebrate; if (!c) return null;
  const close = () => { S.celebrate = null; commit(); };
  return html`<${React.Fragment}><${Confetti} />
    <div className="scrim" role="dialog" aria-modal="true" aria-label=${c.title} onClick=${close}>
      <div className="modal col celebrate" onClick=${(e) => e.stopPropagation()}>
        <div className="trophy"><${Icon} n="trophy" size=${32} /></div>
        <h2>${c.title}</h2><p className="taskline" style=${{ margin: '0 auto' }}>${c.body}</p>
        <button className="btn primary" autoFocus onClick=${close}>Nice</button>
      </div></div><//>`;
}
/* ---------- verification window ----------
   Every action that pays XP, coins or a reward opens this window first. It is driven by a spec object
   (see daySpec in core.js): time logged, written proof, a flash-card knowledge check, a typed word,
   an honesty statement. The confirm button stays disabled until every requested check passes. */
function VerifyHost() { useApp(); const v = S.verifyReq; return v ? html`<${VerifyWindow} key=${v.id} spec=${v} />` : null; }
function VerifyWindow({ spec }) {
  useApp();
  const [proof, setProof] = useState(''), [link, setLink] = useState(''), [att, setAtt] = useState(false), [typed, setTyped] = useState(''), [backup, setBackup] = useState(true);
  const [qs, setQs] = useState(() => (spec.quiz ? buildQuiz(spec.quiz.week, spec.quiz.n) : [])), [ans, setAns] = useState({}), [score, setScore] = useState(null);
  const tm = timerState(); useTick(!!(tm && tm.running));
  useEffect(() => { const f = (e) => { if (e.key === 'Escape') closeVerify(); }; addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);

  const steps = [];
  if (spec.minutes) {
    const have = minutesOn(spec.minutes.date), need = spec.minutes.need, open = tm && tm.date === spec.minutes.date ? Math.floor(timerMs(tm) / 60000) : 0;
    steps.push({ id: 'time', ok: have >= need, title: 'Time on task', node: html`<div className="col gap-6">
      <div className="bar" aria-hidden="true"><i style=${{ width: Math.min(100, (have / need) * 100) + '%' }}></i></div>
      <p className="small muted">${have >= need ? `${fmtMin(have)} logged. ${fmtMin(need)} is required.` : `${fmtMin(have)} logged of the ${fmtMin(need)} required. Use the timer or add time with a note, then come back.`}</p>
      ${tm && tm.date === spec.minutes.date && html`<div className="row wrap"><span className="small">Your timer is open (${open} min). It only counts once you stop it.</span><button type="button" className="btn sm" onClick=${() => timerStop(false)}><${Icon} n="stop" />Stop and log</button></div>`}</div>` });
  }
  if (spec.proof) {
    const problem = proofProblem(proof, spec.proof);
    steps.push({ id: 'proof', ok: !problem, title: spec.proof.label, node: html`<div className="col gap-6">
      <textarea aria-label=${spec.proof.label} value=${proof} placeholder=${spec.proof.placeholder || ''} style=${{ minHeight: 84 }} onInput=${(e) => setProof(e.target.value)}></textarea>
      <p className=${'xs ' + (problem && proof ? '' : 'muted')} style=${problem && proof ? { color: 'var(--accent2)' } : null}>${problem || 'Looks good.'}</p>
      ${spec.link && html`<label className="f">${spec.link.label}<input type="url" inputMode="url" placeholder="https://" value=${link} onInput=${(e) => setLink(e.target.value)} /></label>`}</div>` });
  }
  if (spec.quiz) {
    const need = Math.min(spec.quiz.pass, qs.length), all = qs.length > 0 && qs.every((q) => ans[q.id] !== undefined), passed = score !== null && score >= need;
    const check = () => setScore(qs.filter((q) => q.opts[ans[q.id]].ok).length);
    const retry = () => { setQs(buildQuiz(spec.quiz.week, spec.quiz.n)); setAns({}); setScore(null); };
    steps.push({ id: 'quiz', ok: qs.length === 0 || passed, title: 'Knowledge check', node: !qs.length
      ? html`<p className="small muted">Your deck is too small to build a multiple-choice check, so this step is skipped. Add flash cards in Quiz > Deck to switch it on.</p>`
      : html`<div className="col">
        <p className="small muted">Get ${need} of ${qs.length} right. Questions come from your flash cards for this week and earlier.</p>
        ${qs.map((q, qi) => html`<fieldset key=${q.id} className="vq" disabled=${score !== null}><legend className="small"><strong>${qi + 1}. ${q.q}</strong></legend>
          ${q.opts.map((o, oi) => html`<button type="button" key=${oi} className="opt" aria-pressed=${ans[q.id] === oi} onClick=${() => setAns({ ...ans, [q.id]: oi })}>${o.text}</button>`)}</fieldset>`)}
        ${score === null ? html`<button type="button" className="btn" disabled=${!all} onClick=${check}>Check answers</button>`
          : passed ? html`<p className="chip good" style=${{ alignSelf: 'flex-start' }}>${score}/${qs.length} correct. Passed.</p>`
          : html`<div className="row wrap"><span className="chip lilac">${score}/${qs.length} correct. You need ${need}.</span><button type="button" className="btn" onClick=${retry}>Try new questions</button></div>`}</div>` });
  }
  if (spec.type) steps.push({ id: 'type', ok: typed.trim().toUpperCase() === spec.type, title: `Type ${spec.type} to confirm`, node: html`<input type="text" aria-label=${'Type ' + spec.type} autoComplete="off" autoCapitalize="characters" spellCheck="false" value=${typed} onInput=${(e) => setTyped(e.target.value)} />` });
  if (spec.attest) steps.push({ id: 'attest', ok: att, title: 'Your word', node: html`<label className="check"><input type="checkbox" checked=${att} onChange=${(e) => setAtt(e.target.checked)} /><span>${spec.attest}</span></label>` });

  const ok = steps.every((x) => x.ok);
  const go = () => { if (!ok) return; const quiz = qs.length && score !== null ? `${score}/${qs.length}` : null; closeVerify(); spec.onPass({ proof: proof.trim(), link: link.trim(), quiz, backup }); };
  return html`<div className="scrim" role="dialog" aria-modal="true" aria-label=${spec.title} onClick=${closeVerify}>
    <div className=${'modal wide col' + (spec.danger ? ' danger' : '')} onClick=${(e) => e.stopPropagation()}>
      <div className="row between"><div><span className="chip lilac"><${Icon} n="shield" size=${14} />Verification</span><h2 style=${{ marginTop: 8 }}>${spec.title}</h2></div>${spec.reward && html`<span className="chip amber">${spec.reward}</span>`}</div>
      ${spec.sub && html`<p className="muted small">${spec.sub}</p>`}
      ${spec.facts && html`<div className="col gap-6">${spec.facts.map(([k, v, warn]) => html`<div key=${k} className="row between small"><span className="muted">${k}</span><strong className="num" style=${warn ? { color: 'var(--accent2)' } : null}>${v}</strong></div>`)}</div>`}
      <ol className="vsteps">${steps.map((x) => html`<li key=${x.id} className=${'vrow' + (x.ok ? ' ok' : '')}><span className="vdot" aria-label=${x.ok ? 'Passed' : 'Not yet'}>${x.ok && html`<${Icon} n="check" size=${14} />`}</span><div className="grow col gap-6"><strong className="small">${x.title}</strong>${x.node}</div></li>`)}</ol>
      ${spec.backup && html`<label className="check"><input type="checkbox" checked=${backup} onChange=${(e) => setBackup(e.target.checked)} /><span>Download a backup file first (recommended)</span></label>`}
      <div className="row between"><button type="button" className="btn ghost" onClick=${closeVerify}>Cancel</button>
        <button type="button" className=${'btn ' + (spec.danger ? 'danger' : 'primary')} disabled=${!ok} onClick=${go}>${spec.confirm || 'Verify'}</button></div>
      ${!ok && html`<p className="xs muted" style=${{ textAlign: 'center' }}>Nothing is awarded until every step above is done.</p>`}
    </div></div>`;
}
function Toasts() { return html`<div className="toasts" role="status" aria-live="polite">${S.toasts.map((t) => html`<div key=${t.id} className=${'toast ' + t.kind}>${t.msg}</div>`)}</div>`; }
function Banners() {
  if (!S.banners.length) return null;
  return html`<div className="col" style=${{ gap: 8 }}>${S.banners.map((b) => html`<div key=${b.id} className="banner" role="status">
    <${Icon} n="bell" /><div className="grow"><strong>${b.title}</strong><div className="small muted">${b.body}</div></div>
    <button className="btn sm" onClick=${() => { goTab(b.tab); dismissBanner(b.id); }}>Open</button>
    <button className="btn sm icon ghost" aria-label="Dismiss reminder" onClick=${() => dismissBanner(b.id)}><${Icon} n="x" /></button></div>`)}</div>`;
}

/* ---------- navigation (hash based so tabs can be deep-linked) ---------- */
const TABS = [['today', 'Today', 'Today', 'today'], ['plan', 'Plan', 'Plan', 'plan'], ['quiz', 'Quiz', 'Quiz', 'quiz'], ['dashboard', 'Dashboard', 'Dash', 'dash'],
  ['rewards', 'Rewards', 'Rewards', 'rewards'], ['certs', 'Certs & Projects', 'Certs', 'certs'], ['settings', 'Settings', 'Settings', 'settings']];
const goTab = (t) => { location.hash = '#' + t; };
function useTab() {
  const read = () => { const h = location.hash.slice(1); return TABS.some((t) => t[0] === h) ? h : 'today'; };
  const [t, setT] = useState(read);
  useEffect(() => { const f = () => { setT(read()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return t;
}

/* the live rows of an activity feed, derived from stored history */
function feedItems(limit = 8) {
  const out = [];
  for (const e of Object.values(S.ledger)) {
    if (e.kind === 'minutes') continue;
    out.push({ ts: e.ts, icon: e.kind === 'penalty' ? 'coin' : e.kind === 'spend' ? 'rewards' : e.kind === 'cert' ? 'certs' : e.kind === 'quiz' ? 'quiz' : e.kind === 'streak' ? 'flame' : e.kind === 'chest' ? 'rewards' : 'check', title: e.label,
      amount: [e.xp ? `+${e.xp} XP` : '', e.coins ? `${e.coins > 0 ? '+' : '−'}${Math.abs(e.coins)} c` : ''].filter(Boolean).join('  ') || '·', detail: fmtDate(e.date) });
  }
  for (const s of S.sessions) if (s.kind === 'timer') out.push({ ts: s.endMs, icon: 'play', title: `Study session ${fmtMin(s.minutes)}`, amount: '', detail: fmtDate(s.date) });
  for (const b of Object.values(S.badges)) out.push({ ts: b.ts, icon: 'star', title: 'Badge: ' + badgeDef(b.id).name, amount: '', detail: fmtDate(b.date) });
  for (const q of S.quizSessions) out.push({ ts: q.ts, icon: 'quiz', title: `Quiz session ${q.correct}/${q.total}`, amount: `${Math.round((q.correct / q.total) * 100)}%`, detail: fmtDate(q.date) });
  return out.sort((a, b) => b.ts - a.ts).slice(0, limit);
}
