/* =====================================================================
   STUDY TRACKER - ui_dash.js   Dashboard: bento grid ported from dashboard.txt
   (web3-bento).  Same tile shell, count-up numbers, animated charts, fanned
   card stack and reduced-motion handling - with study data instead of crypto.
   ===================================================================== */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ACC = 'var(--accent)', ACC2 = 'var(--accent2)';
const smooth = (pts) => pts.map(([x, y], i) => {
  if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  const [px, py] = pts[i - 1], m = (px + x) / 2;
  return `C ${m.toFixed(1)} ${py.toFixed(1)}, ${m.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(' ');

/* ---------- hero: greeting, level, XP bar, overall %, 30-day study strip ---------- */
function HeroTile({ reduced }) {
  const mounted = useMounted(), t = today();
  const lv = levelInfo(), xp = lv.xp;
  const total = S.plan.length, done = Object.values(S.days).filter((r) => r.status === 'done' && planFor(r.date)).length;
  const pct = useCountUp((done / total) * 100, !reduced);
  const days = Array.from({ length: 30 }, (_, i) => addDays(t, i - 29)), mins = days.map(minutesOn), max = Math.max(...mins, 30);
  const [hover, setHover] = useState(null);
  const hr = new Date().getHours(), hi = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const total30 = mins.reduce((a, b) => a + b, 0);
  return html`<${Tile} className="b-hero span2">
    <div className="row wrap between" style=${{ alignItems: 'flex-start', gap: 24 }}>
      <div style=${{ minWidth: 0, flex: '1 1 260px' }}>
        <p style=${{ fontSize: 'clamp(26px,5vw,34px)', fontWeight: 620, lineHeight: 1.1, letterSpacing: '-0.03em' }}>${hi}, <span style=${{ color: 'var(--accent-fg)' }}>${lv.name}</span></p>
        <p className="small muted" style=${{ marginTop: 4 }}>${xp.toLocaleString()} XP${lv.next ? ` · ${(lv.hi - xp).toLocaleString()} to ${lv.next}` : ' · top level reached'}</p>
        <div className="bar" style=${{ marginTop: 12, maxWidth: 360 }} role="progressbar" aria-label="XP progress" aria-valuenow=${Math.round(lv.pct * 100)} aria-valuemin="0" aria-valuemax="100"><i style=${{ width: (mounted ? lv.pct * 100 : 0) + '%' }}></i></div>
      </div>
      <div style=${{ textAlign: 'right' }}><p className="xs muted">Roadmap complete</p><p className="big" style=${{ fontSize: 'clamp(32px,6vw,40px)' }}>${pct.toFixed(1)}%</p><p className="num xs muted" style=${{ marginTop: 6 }}>${done} of ${total} days</p></div>
    </div>
    <div style=${{ marginTop: 22, display: 'flex', flex: 1, flexDirection: 'column' }}>
      <div className="strip" onPointerLeave=${() => setHover(null)}>${mins.map((m, i) => html`<button key=${i} type="button" aria-label=${`${fmtDate(days[i])}: ${fmtMin(m)}`} onPointerEnter=${() => setHover(i)} onFocus=${() => setHover(i)} onBlur=${() => setHover(null)}
        style=${{ height: mounted ? Math.max(6, (m / max) * 100) + '%' : '6%', background: m ? ACC : 'var(--muted)', opacity: hover === null ? (m ? 0.4 + (m / max) * 0.6 : 1) : hover === i ? 1 : 0.28, transition: `height 900ms ${EASE} ${i * 18}ms, opacity 200ms ease` }}></button>`)}</div>
      <div className="row between mono xs muted" style=${{ marginTop: 8 }}><span>${fmtDate(days[0])}</span><span style=${{ color: 'var(--foreground)' }} aria-live="polite">${hover !== null ? `${fmtDate(days[hover])} · ${fmtMin(mins[hover])}` : `Last 30 days · ${fmtMin(total30)}`}</span><span>Today</span></div>
    </div></${Tile}>`;
}

/* ---------- certification card stack (fan, tap a card to bring it forward) ---------- */
const CARD_COLORS = [['oklch(0.84 0.14 80)', 'oklch(0.7 0.16 45)', 'oklch(0.25 0.05 50)'], ['oklch(0.8 0.1 300)', 'oklch(0.62 0.16 285)', 'oklch(0.2 0.06 290)'],
  ['oklch(0.86 0.1 95)', 'oklch(0.74 0.15 70)', 'oklch(0.24 0.05 70)'], ['oklch(0.78 0.11 285)', 'oklch(0.68 0.13 320)', 'oklch(0.2 0.06 300)'],
  ['oklch(0.83 0.13 60)', 'oklch(0.72 0.14 30)', 'oklch(0.24 0.05 40)'], ['oklch(0.76 0.1 310)', 'oklch(0.6 0.15 280)', 'oklch(0.2 0.06 290)']];
const shortCert = (c) => c.name.replace('Microsoft ', '').replace('Red Team Leaders ', '').replace('INE ', '').replace('TCM ', '').replace('CompTIA ', '').replace('Certified in Cybersecurity ', '').replace('ISC2 ', 'ISC2 ');
function CardFace({ c, glare }) {
  return html`<${React.Fragment}><span aria-hidden="true" style=${{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 12, backgroundImage: ['linear-gradient(180deg, oklch(1 0 0 / 0.3) 0%, transparent 34%)', `radial-gradient(110% 90% at 100% 0%, ${c.color2} 0%, transparent 60%)`, `linear-gradient(135deg, ${c.color} 0%, ${c.color2} 100%)`].join(', '), boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.5), inset 0 0 0 1px oklch(1 0 0 / 0.16)' }}>
      <span style=${{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(115deg, transparent 18%, oklch(0.9 0.12 350 / 0.55) 32%, oklch(0.92 0.1 220 / 0.55) 42%, oklch(0.94 0.14 130 / 0.5) 52%, oklch(0.92 0.12 60 / 0.45) 62%, transparent 78%)', backgroundSize: '260% 100%', backgroundPosition: `${glare}% 0`, mixBlendMode: 'soft-light' }}></span></span>
    <span style=${{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 14px 0' }}>
      <span style=${{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}><svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true"><rect x="0.5" y="0.5" width="25" height="19" rx="4.5" fill="oklch(0.9 0.06 90)" stroke="oklch(0.62 0.07 80 / 0.6)" /><path d="M0.5 7h7.5v6H0.5M25.5 7H18v6h7.5M8 0.5v19M18 0.5v19M8 10h10" fill="none" stroke="oklch(0.6 0.07 80 / 0.55)" strokeWidth="0.9" /></svg>
        <span style=${{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${c.label}</span></span>
      <span className="mono" style=${{ fontSize: 12, fontWeight: 600, flex: 'none' }}>${c.badge}</span></span><//>`;
}
function CardsTile({ reduced }) {
  const certs = S.certs, mounted = useMounted(), PEEK = 28;
  const cards = certs.map((c, i) => { const d = certDate(c), left = d ? diffDays(d, today()) : null; const [a, b, ink] = CARD_COLORS[i % CARD_COLORS.length];
    return { id: c.id, label: shortCert(c), badge: c.status === 'passed' ? 'PASSED' : left === null ? c.status.toUpperCase() : left >= 0 ? left + ' d' : 'DUE', sub: c.name, holder: d ? 'Target ' + fmtDate(d) : 'Roadmap day ' + c.targetDay, color: a, color2: b, ink, status: c.status }; });
  const [order, setOrder] = useState(() => cards.map((c) => c.id));
  useEffect(() => { setOrder((o) => (o.length === cards.length && cards.every((c) => o.includes(c.id)) ? o : cards.map((c) => c.id))); }, [cards.length]);
  const [glare, setGlare] = useState(30), drag = useRef(false);
  useEffect(() => { if (reduced) return; let raf = 0; const t0 = performance.now(); const tick = (now) => { if (!drag.current) setGlare(30 + Math.sin((now - t0) / 2600) * 30); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [reduced]);
  const depth = order.length - 1, front = cards.find((c) => c.id === order[order.length - 1]);
  if (!front) return null;
  return html`<${Tile} className="b-cards" title=${html`<span>Certifications <sup className="mono xs">${certs.length}</sup></span>`}>
    <div className="cardstack" onPointerMove=${(e) => { const r = e.currentTarget.getBoundingClientRect(); drag.current = true; setGlare(((e.clientX - r.left) / r.width) * 100); }} onPointerLeave=${() => { drag.current = false; }}>
      <div style=${{ position: 'relative' }}>
        ${order.map((id, pos) => { const c = cards.find((x) => x.id === id), from = order.length - 1 - pos, isFront = from === 0;
          return html`<button key=${id} type="button" className="cs" onClick=${() => !isFront && setOrder((o) => [...o.filter((x) => x !== id), id])} aria-label=${`${c.sub}, ${c.badge}${isFront ? ', selected' : ', bring to front'}`} aria-pressed=${isFront}
            style=${{ top: (depth - from) * PEEK, zIndex: pos + 1, transform: `translateX(-50%) scale(${1 - from * 0.04}) translateY(${mounted ? 0 : 20}px)`, opacity: mounted ? 1 : 0, color: c.ink, cursor: isFront ? 'default' : 'pointer',
              transition: reduced ? 'none' : `top 650ms cubic-bezier(0.34,1.35,0.64,1), transform 650ms cubic-bezier(0.34,1.35,0.64,1), opacity 500ms ease ${pos * 90}ms` }}>
            <span style=${{ position: 'relative', display: 'block', width: '100%', paddingTop: '63.08%' }}><span style=${{ position: 'absolute', inset: 0, display: 'block' }}><${CardFace} c=${c} glare=${glare + from * 18} /></span></span></button>`; })}
        <div aria-hidden="true" style=${{ visibility: 'hidden', margin: '0 auto', width: 'calc(100% - 32px)', maxWidth: 300, marginTop: depth * PEEK }}><div style=${{ paddingTop: '30%' }}></div></div>
      </div>
      <div className="panel" aria-live="polite"><div style=${{ minWidth: 0 }}><p className="truncate" style=${{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${front.sub}</p><p className="xs muted" style=${{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${front.holder}</p></div><p className="num" style=${{ fontSize: 15, fontWeight: 600, flex: 'none' }}>${front.badge}</p></div>
    </div></${Tile}>`;
}

/* ---------- gauge: streak (or weekly focus) ---------- */
function GaugeTile({ reduced }) {
  const [mode, setMode] = useState('Streak'), d = S.derived, t = today();
  const ws = startOfWeek(t, S.settings.weekStart); let fs = 0, fn = 0; for (let i = 0; i < 7; i++) { const c = S.checkins[addDays(ws, i)]; if (c) { fs += c.focus; fn++; } }
  const focus = fn ? (fs / fn) * 20 : 0;
  const milestones = [7, 30, 100, 200, 365], nextM = milestones.find((m) => m > d.streak) || 365;
  const value = mode === 'Streak' ? d.streak : Math.round(focus), tt = mode === 'Streak' ? Math.min(1, d.streak / nextM) : focus / 100, R = 62, len = Math.PI * R, angle = -90 + tt * 180;
  const toShield = CONFIG.shield.every - (d.streak % CONFIG.shield.every);
  return html`<${Tile} className="b-gauge" title=${mode === 'Streak' ? 'Streak' : 'Weekly focus'} action=${html`<span className="chip ${d.streak > 0 ? 'amber' : ''}"><${Icon} n="shield" size=${13} />${d.shields}/${CONFIG.shield.max}</span>`}>
    <div style=${{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style=${{ position: 'relative', width: 150, height: 86 }}><svg width="150" height="86" viewBox="0 0 150 86" aria-hidden="true">
        <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" style=${{ stroke: 'var(--muted)' }} />
        <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray=${len} style=${{ stroke: ACC, strokeDashoffset: len * (1 - tt), transition: reduced ? 'none' : `stroke-dashoffset 900ms ${EASE}` }} />
        <g style=${{ transform: `rotate(${angle}deg)`, transformOrigin: '75px 78px', transition: reduced ? 'none' : `transform 900ms ${EASE}` }}><line x1="75" y1="78" x2="75" y2="30" strokeWidth="2.5" strokeLinecap="round" style=${{ stroke: 'var(--foreground)' }} /></g>
        <circle cx="75" cy="78" r="5" style=${{ fill: 'var(--foreground)' }} /></svg></div>
      <p className="num" style=${{ marginTop: 8, fontSize: 26, fontWeight: 600, lineHeight: 1 }}>${value}${mode === 'Streak' ? html` <span className="small muted">day${value === 1 ? '' : 's'}</span>` : html`<span className="small muted">%</span>`}</p>
      <p className="mono xs muted" style=${{ marginTop: 4 }}>${mode === 'Streak' ? `Longest ${d.longest} · next shield in ${d.shields >= CONFIG.shield.max ? '–' : toShield + ' d'}` : fn ? `${fn} check-in${fn > 1 ? 's' : ''} this week` : 'Log a daily check-in'}</p>
    </div><div style=${{ marginTop: 14, display: 'flex', justifyContent: 'center' }}><${Pills} label="Gauge" value=${mode} options=${['Streak', 'Focus']} onChange=${setMode} /></div></${Tile}>`;
}

/* ---------- chart: cumulative study hours vs planned pace ---------- */
function ChartTile({ reduced }) {
  const uid = React.useId().replace(/:/g, ''), [range, setRange] = useState('1Y'), [hover, setHover] = useState(null), mounted = useMounted();
  const { planned, actual, start } = useMemo(paceSeries, [version]), n = planned.length, t = today();
  const ti = clamp(diffDays(t, start), 0, n - 1), started = diffDays(t, start) >= 0;
  const take = { '1W': 8, '1M': 31, '1Y': n }[range], step = range === '1Y' ? 7 : 1;
  const endI = range === '1Y' ? n - 1 : Math.min(n - 1, Math.max(ti, take - 1)), from = Math.max(0, endI - take + 1);
  const idxs = []; for (let i = from; i <= endI; i++) if ((i - from) % step === 0 || i === endI || (i === ti && started)) idxs.push(i);
  const W = 640, H = 220; const vals = idxs.flatMap((i) => (actual[i] !== null && started ? [planned[i], actual[i]] : [planned[i]]));
  const lo = Math.min(...vals, 0), hi = Math.max(...vals, 1), y = (v) => H - 16 - ((v - lo) / (hi - lo || 1)) * (H - 40), x = (k) => (k / (idxs.length - 1 || 1)) * W;
  const pp = idxs.map((i, k) => [x(k), y(planned[i])]), aIdx = idxs.filter((i) => started && i <= ti), ap = aIdx.map((i) => [x(idxs.indexOf(i)), y(actual[i])]);
  const hk = hover ?? Math.max(0, idxs.filter((i) => i <= ti).length - 1), hi_ = idxs[hk], lead = started ? actual[ti] - planned[ti] : 0;
  const la = ap.length > 1 ? smooth(ap) : '', lp = smooth(pp);
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(clamp(Math.round(((e.clientX - r.left) / r.width) * (idxs.length - 1)), 0, idxs.length - 1)); };
  const shown = actual[hi_] !== null && started ? actual[hi_] : null;
  return html`<${Tile} className="b-chart span2" title="Study hours vs planned pace" action=${html`<${Pills} label="Chart range" value=${range} options=${['1W', '1M', '1Y']} onChange=${setRange} />`}>
    <div className="row wrap gap-24" style=${{ alignItems: 'flex-end' }}>
      <div><p className="row gap-6 xs muted"><span style=${{ height: 3, width: 16, borderRadius: 99, background: ACC }} aria-hidden="true"></span>Actual</p><p className="big" style=${{ fontSize: 22, marginTop: 4 }}>${shown === null ? '–' : shown.toFixed(1) + ' h'}</p></div>
      <div><p className="row gap-6 xs muted"><span style=${{ width: 16, borderTop: '2px dashed var(--muted-foreground)' }} aria-hidden="true"></span>Planned pace</p><p className="big muted" style=${{ fontSize: 22, marginTop: 4 }}>${planned[hi_].toFixed(1)} h</p></div>
      <span className=${'chip ' + (lead >= 0 ? 'good' : 'lilac')} style=${{ marginLeft: 'auto' }}>${!started ? 'Plan starts ' + fmtDate(start) : lead >= 0 ? `${lead.toFixed(1)} h ahead` : `${Math.abs(lead).toFixed(1)} h to catch up`}</span></div>
    <div className="chartwrap" style=${{ marginTop: 14 }} onPointerMove=${onMove} onPointerLeave=${() => setHover(null)} role="img" aria-label=${`Cumulative study hours ${shown === null ? 'not started' : shown.toFixed(1)} versus planned ${planned[ti].toFixed(1)} hours`}>
      <svg viewBox=${`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id=${uid + 'f'} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style=${{ stopColor: ACC, stopOpacity: 0.28 }} /><stop offset="1" style=${{ stopColor: ACC, stopOpacity: 0 }} /></linearGradient></defs>
        ${[0.25, 0.5, 0.75].map((f) => html`<line key=${f} x1="0" x2=${W} y1=${H * f} y2=${H * f} vectorEffect="non-scaling-stroke" strokeDasharray="1 5" style=${{ stroke: 'var(--border)' }} />`)}
        ${ap.length > 1 && html`<path d=${`${la} L ${ap[ap.length - 1][0]} ${H} L 0 ${H} Z`} fill=${`url(#${uid}f)`} style=${{ opacity: mounted ? 1 : 0, transition: 'opacity 900ms ease 400ms' }} />`}
        <path d=${lp} fill="none" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" style=${{ stroke: 'var(--muted-foreground)' }} />
        ${ap.length > 1 && html`<path key=${range} d=${la} fill="none" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength="1" style=${{ stroke: ACC, strokeDasharray: 1, strokeDashoffset: mounted || reduced ? 0 : 1, transition: reduced ? 'none' : `stroke-dashoffset 1300ms ${EASE}` }} />`}</svg>
      <span className="dot" aria-hidden="true" style=${{ left: (hk / (idxs.length - 1 || 1)) * 100 + '%', top: (pp[hk][1] / H) * 100 + '%', background: 'var(--muted-foreground)', width: 10, height: 10 }}></span>
      ${shown !== null && ap.length > 0 && html`<span className="dot" aria-hidden="true" style=${{ left: ((idxs.indexOf(aIdx.includes(hi_) ? hi_ : aIdx[aIdx.length - 1])) / (idxs.length - 1 || 1)) * 100 + '%', top: (y(actual[aIdx.includes(hi_) ? hi_ : aIdx[aIdx.length - 1]]) / H) * 100 + '%', background: ACC }}></span>`}
    </div>
    <div className="row between mono xs muted" style=${{ marginTop: 10 }} aria-hidden="true"><span>${fmtDate(addDays(start, idxs[0]))}</span><span style=${{ color: 'var(--foreground)' }}>${fmtDate(addDays(start, hi_))}</span><span>${fmtDate(addDays(start, idxs[idxs.length - 1]))}</span></div>
    ${!started && html`<p className="small muted" style=${{ marginTop: 8 }}>Your actual line starts when the plan does. The dashed line is the pace to follow.</p>`}</${Tile}>`;
}

/* ---------- allocation: time per phase ---------- */
function AllocTile() {
  const mounted = useMounted(), [hover, setHover] = useState(null);
  const mins = S.phases.map(() => 0); const byDate = {}; S.sessions.forEach((s) => { byDate[s.date] = (byDate[s.date] || 0) + s.minutes; });
  for (const [d, m] of Object.entries(byDate)) { const p = planFor(d); const k = p ? p.phase - 1 : -1; if (k >= 0 && k < mins.length) mins[k] += m; }
  const total = mins.reduce((a, b) => a + b, 0);
  const colors = [ACC, ACC2, 'oklch(0.78 0.1 190)', 'oklch(0.72 0.1 140)', 'oklch(0.78 0.04 280)', 'oklch(0.62 0.05 20)', 'oklch(0.6 0.03 280)', 'oklch(0.45 0.02 280)'];
  return html`<${Tile} className="b-alloc" title="Time per phase">
    <p className="big" style=${{ fontSize: 22 }}>${(total / 60).toFixed(1)} h</p>
    <div className="row" style=${{ gap: 3, height: 36, marginTop: 14 }} onPointerLeave=${() => setHover(null)}>${mins.map((m, i) => html`<span key=${i} onPointerEnter=${() => setHover(i)} aria-hidden="true" style=${{ borderRadius: 8, height: '100%', flexBasis: mounted ? (total ? Math.max(1.5, (m / total) * 100) : 12.5) + '%' : '12.5%', flexGrow: 0, background: total ? colors[i] : 'var(--muted)', opacity: hover === null || hover === i ? 1 : 0.3, transition: `flex-basis 1000ms ${EASE} ${200 + i * 60}ms, opacity 200ms` }}></span>`)}</div>
    <div className="legend" style=${{ marginTop: 14 }}><ul>${S.phases.slice(0, 4).map((p, i) => html`<li key=${p.num} onPointerEnter=${() => setHover(i)} onPointerLeave=${() => setHover(null)}><span className="row gap-6" style=${{ minWidth: 0 }}><span style=${{ width: 8, height: 8, borderRadius: 99, background: colors[i], flex: 'none' }}></span><span style=${{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${p.name}</span></span><span className="num muted">${total ? ((mins[i] / total) * 100).toFixed(0) : 0}%</span></li>`)}</ul>
      <ul>${S.phases.slice(4).map((p, j) => { const i = j + 4; return html`<li key=${p.num} onPointerEnter=${() => setHover(i)} onPointerLeave=${() => setHover(null)}><span className="row gap-6" style=${{ minWidth: 0 }}><span style=${{ width: 8, height: 8, borderRadius: 99, background: colors[i], flex: 'none' }}></span><span style=${{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${p.name}</span></span><span className="num muted">${total ? ((mins[i] / total) * 100).toFixed(0) : 0}%</span></li>`; })}</ul></div>
    ${!total && html`<p className="xs muted" style=${{ marginTop: 10 }}>Log study time and your phases fill in.</p>`}</${Tile}>`;
}

/* ---------- today tile (solid amber, like the staking tile in the reference) ---------- */
function TodayTile() {
  useApp(); const tm = timerState(); useTick(!!(tm && tm.running)); const [ask, confirmNode] = useConfirm();
  const t = today(), p = planFor(t), r = rec(t), mins = minutesOn(t), target = (p ? CONFIG.plannedHours[hoursKey(p.type)] : CONFIG.plannedHours.study) * 60;
  const live = tm && tm.date === t ? tm : null, pre = t < S.settings.planStart;
  return html`<${Tile} accent=${true} className="b-today" title="Today" action=${p && html`<span className="chip" style=${{ background: 'color-mix(in oklch, var(--accent-ink) 12%, transparent)', color: 'var(--accent-ink)' }}>Day ${p.day}</span>`}>
    <p style=${{ fontSize: 17, fontWeight: 560, lineHeight: 1.35, letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>${pre ? `Plan starts ${fmtDate(S.settings.planStart)}` : p ? p.task : 'No roadmap task today'}</p>
    <div style=${{ marginTop: 18, fontSize: 'clamp(30px, 3.2vw, 40px)' }} className="timer" role="timer">${fmtClock(live ? timerMs(live) : 0)}</div>
    <div className="bar" style=${{ marginTop: 14 }} aria-label="Study time against today's target"><i style=${{ width: Math.min(100, (mins / target) * 100) + '%' }}></i></div>
    <p className="num xs" style=${{ marginTop: 6, opacity: 0.75 }}>${fmtMin(mins)} of ${fmtMin(target)} target</p>
    <div style=${{ marginTop: 'auto', paddingTop: 18 }} className="col">
      <div className="row">${!tm ? html`<button className="btn dark grow" onClick=${timerStart}><${Icon} n="play" />Start</button>` : html`<button className="btn dark grow" onClick=${() => (tm.running ? timerPause() : timerResume())}><${Icon} n=${tm.running ? 'pause' : 'play'} />${tm.running ? 'Pause' : 'Resume'}</button><button className="btn dark grow" onClick=${() => timerStop(false)}><${Icon} n="stop" />Stop</button>`}</div>
      ${tm && html`<button className="btn dark" onClick=${() => ask('Discard this timer?', 'The running session will not be logged.', 'Discard', () => timerStop(true))}>Discard timer</button>`}
      ${p && html`<button className="btn dark" style=${{ opacity: r.status === 'done' ? 0.65 : 1 }} onClick=${() => completeDay(t)}><${Icon} n="check" />${r.status === 'done' ? 'Completed' : 'Mark complete'}</button>`}</div>${confirmNode}</${Tile}>`;
}

/* ---------- weekly hours vs target ---------- */
function WeekTile() {
  const t = today(), ws = startOfWeek(t, S.settings.weekStart), days = Array.from({ length: 7 }, (_, i) => addDays(ws, i)), mounted = useMounted();
  const hrs = days.map((d) => minutesOn(d) / 60), tgt = days.map((d) => plannedHoursOn(d) || CONFIG.plannedHours.study);
  const sum = hrs.reduce((a, b) => a + b, 0), tsum = tgt.reduce((a, b) => a + b, 0), max = Math.max(...hrs, ...tgt) * 1.1;
  return html`<${Tile} className="b-week" title="Hours this week" action=${html`<span className="num xs muted">${sum.toFixed(1)} / ${tsum.toFixed(1)} h</span>`}>
    <div style=${{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 96 }}>${days.map((d, i) => html`<div key=${d} style=${{ flex: 1, height: '100%', position: 'relative', display: 'flex', alignItems: 'flex-end' }} title=${`${fmtDate(d)}: ${hrs[i].toFixed(1)} h target ${(plannedHoursOn(d) || CONFIG.plannedHours.study)} h`}>
      <span aria-hidden="true" style=${{ position: 'absolute', left: 0, right: 0, bottom: (tgt[i] / max) * 100 + '%', borderTop: '1.5px dashed var(--muted-foreground)', opacity: 0.6 }}></span>
      <span style=${{ width: '100%', borderRadius: 6, background: d === t ? ACC : ACC2, opacity: hrs[i] ? 1 : 0.25, height: mounted ? Math.max(4, (hrs[i] / max) * 100) + '%' : '4%', transition: `height 900ms ${EASE} ${i * 50}ms` }}></span></div>`)}</div>
    <div className="row mono" style=${{ marginTop: 8, gap: 6, fontSize: 10.5, color: 'var(--muted-foreground)' }}>${days.map((d) => html`<span key=${d} style=${{ flex: 1, textAlign: 'center', color: d === t ? 'var(--foreground)' : undefined }}>${DOWS[dowOf(d)][0]}</span>`)}</div>
    <p className="xs muted" style=${{ marginTop: 8 }}>Targets: ${CONFIG.targetText.study} study days, ${CONFIG.targetText.lab} lab days, ${CONFIG.targetText.review} review days</p></${Tile}>`;
}

/* ---------- heatmap (GitHub-style) ---------- */
function HeatTile() {
  const start = S.settings.planStart, t = today(), gs = startOfWeek(start, 1), n = Math.ceil((diffDays(planEnd(), gs) + 1) / 7) * 7;
  const byDate = {}; S.sessions.forEach((s) => { byDate[s.date] = (byDate[s.date] || 0) + s.minutes; });
  const cells = Array.from({ length: n }, (_, i) => { const d = addDays(gs, i), m = byDate[d] || 0; return { d, m, cls: d < start || d > planEnd() ? 'hide' : d > t ? 'future' : m >= 180 ? 'l4' : m >= 120 ? 'l3' : m >= 60 ? 'l2' : m > 0 ? 'l1' : '' }; });
  const days = Object.values(byDate).filter((m) => m > 0).length, ref = useRef(null);
  useEffect(() => { if (ref.current) { const el = ref.current, col = Math.max(0, Math.floor(diffDays(t, gs) / 7) - 8); el.scrollLeft = col * 15; } }, []);
  return html`<${Tile} className="b-heat span2" title="Study days" action=${html`<span className="num xs muted">${days} day${days === 1 ? '' : 's'} logged</span>`}>
    <div className="heat" ref=${ref} role="img" aria-label=${`Heat map of study minutes per day, ${days} days with study logged`}>${cells.map((c) => html`<i key=${c.d} className=${c.cls} title=${c.cls === 'hide' ? '' : `${fmtDate(c.d)}: ${fmtMin(c.m)}`} style=${c.cls === 'hide' ? { visibility: 'hidden' } : null}></i>`)}</div>
    <div className="row xs muted" style=${{ marginTop: 10, gap: 6 }}>Less <span className="hl">${['', 'l1', 'l2', 'l3', 'l4'].map((c) => html`<i key=${c} className=${c}></i>`)}</span> More</div></${Tile}>`;
}

/* ---------- coins + shop ---------- */
function CoinsTile({ reduced }) {
  const { coins } = totals(), shown = useCountUp(coins, !reduced, 900), rs = [...S.rewards].sort((a, b) => a.cost - b.cost);
  const ready = [...rs].reverse().find((r) => r.cost <= coins), nextR = rs.find((r) => r.cost > coins);
  return html`<${Tile} className="b-coins" title="Coins" action=${html`<span className="chip"><${Icon} n="shield" size=${13} />${S.derived.shields}/${CONFIG.shield.max} shields</span>`}>
    <p className="big">${Math.round(shown)}</p>
    <div className="col" style=${{ marginTop: 14, gap: 8 }}>
      ${ready && html`<div className="row between"><span className="small"><span className="chip good">Ready</span> ${ready.name}</span><button className="btn sm primary" onClick=${() => goTab('rewards')}>Redeem</button></div>`}
      ${nextR ? html`<div><div className="row between small"><span>Next: ${nextR.name}</span><span className="num muted">${nextR.cost - coins} to go</span></div><div className="bar lilac" style=${{ marginTop: 6 }}><i style=${{ width: Math.min(100, (coins / nextR.cost) * 100) + '%' }}></i></div></div>` : !ready && html`<p className="small muted">Add a reward in the shop to save toward.</p>`}</div></${Tile}>`;
}

/* ---------- projects + exams ---------- */
function ProjTile() {
  const done = S.projects.filter((p) => p.status === 'published').length;
  return html`<${Tile} className="b-proj" title="Projects" action=${html`<button className="btn sm ghost" onClick=${() => goTab('certs')}>Open</button>`}>
    <p className="big">${done}<span className="muted" style=${{ fontSize: 20 }}> / 12</span></p>
    <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginTop: 16 }}>${S.projects.map((p) => html`<span key=${p.num} title=${`Project ${p.num}: ${p.name}`} style=${{ aspectRatio: '1', borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, background: p.status === 'published' ? ACC : p.status === 'in-progress' ? 'color-mix(in oklch, var(--accent2) 45%, var(--muted))' : 'var(--muted)', color: p.status === 'published' ? 'var(--accent-ink)' : 'var(--muted-foreground)' }}>${p.num}</span>`)}</div></${Tile}>`;
}
function ExamsTile() {
  const t = today(), list = S.certs.filter((c) => c.status !== 'passed').map((c) => ({ c, d: certDate(c) })).filter((x) => x.d).sort((a, b) => (a.d < b.d ? -1 : 1)).slice(0, 4);
  return html`<${Tile} className="b-exams span2" title="Upcoming exams">${list.length ? html`<ul className="feed">${list.map(({ c, d }) => { const left = diffDays(d, t); return html`<li key=${c.id}><span className="ic"><${Icon} n="certs" /></span><div style=${{ minWidth: 0, flex: 1 }}><p style=${{ fontSize: 13, fontWeight: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${c.name}</p><p className="xs muted">${fmtDate(d)} · ${c.status}</p></div><span className=${'chip ' + (left >= 0 && left <= 14 ? 'amber' : '')}><span className="num">${left >= 0 ? left + ' days' : Math.abs(left) + ' d ago'}</span></span></li>`; })}</ul>` : html`<${Empty}>No upcoming exams. Nicely done.<//>`}</${Tile}>`;
}
function FeedTile() {
  const items = feedItems(5), mounted = useMounted();
  return html`<${Tile} className="b-feed span2" title="Recent activity">${items.length ? html`<ul className="feed">${items.map((a, i) => html`<li key=${a.ts + a.title} style=${{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(6px)', transition: `opacity 500ms ease ${300 + i * 70}ms, transform 500ms ${EASE} ${300 + i * 70}ms` }}>
    <span className="ic"><${Icon} n=${a.icon} /></span><div style=${{ minWidth: 0, flex: 1 }}><p style=${{ fontSize: 13, fontWeight: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${a.title}</p><p className="xs muted">${a.detail}</p></div><span className="num" style=${{ fontSize: 12, textAlign: 'right' }}>${a.amount}</span></li>`)}</ul>` : html`<${Empty}>Study sessions, XP, badges and quiz results show up here.<//>`}</${Tile}>`;
}

function DashboardPage() {
  useApp(); const reduced = useReducedMotion();
  if (!isStarted()) return html`<${StartCard} />`;
  return html`<div className="page"><div className="page-head"><div><h1>Dashboard</h1><p className="muted">Your year at a glance.</p></div></div>
    <div className="bento"><${HeroTile} reduced=${reduced} /><${CardsTile} reduced=${reduced} /><${GaugeTile} reduced=${reduced} /><${ChartTile} reduced=${reduced} /><${AllocTile} /><${TodayTile} /><${WeekTile} /><${HeatTile} /><${CoinsTile} reduced=${reduced} /><${ProjTile} /><${FeedTile} /><${ExamsTile} /></div></div>`;
}
