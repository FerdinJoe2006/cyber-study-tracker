/* =====================================================================
   STUDY TRACKER - ui_today.js   Today screen + Plan (week / month / all / catch-up)
   ===================================================================== */

/* text field that saves shortly after you stop typing and on blur */
function useDraft(value, onSave) {
  const [v, setV] = useState(value || ''); const t = useRef(null); const last = useRef(value || '');
  useEffect(() => { setV(value || ''); last.current = value || ''; }, [value]);
  const flush = (x) => { clearTimeout(t.current); if (x !== last.current) { last.current = x; onSave(x); } };
  return [v, (x) => { setV(x); clearTimeout(t.current); t.current = setTimeout(() => flush(x), 700); }, () => flush(v)];
}

/* ---------- notes: markdown, "what I learned", link ---------- */
function NotesTile({ date }) {
  useApp();
  const r = rec(date);
  const [notes, setNotes, flushNotes] = useDraft(r.notes, (x) => patchDay(date, { notes: x }));
  const [learned, setLearned, flushLearned] = useDraft(r.learned, (x) => patchDay(date, { learned: x }));
  const [link, setLink, flushLink] = useDraft(r.link, (x) => patchDay(date, { link: x }));
  const [preview, setPreview] = useState(false);
  return html`<${Tile} title="Notes" action=${html`<${Pills} label="Notes mode" value=${preview ? 'Preview' : 'Write'} options=${['Write', 'Preview']} onChange=${(v) => setPreview(v === 'Preview')} />`}>
    <div className="col">
      ${preview ? html`<div style=${{ minHeight: 96 }}>${notes.trim() ? html`<${Markdown} text=${notes} />` : html`<${Empty}>Nothing written yet.<//>`}</div>`
        : html`<label className="f"><span className="sr">Notes in markdown</span><textarea id="note-area" value=${notes} placeholder="Notes in markdown: # heading, **bold**, - list, \`code\`" onInput=${(e) => setNotes(e.target.value)} onBlur=${flushNotes}></textarea></label>`}
      <label className="f">What I learned<textarea style=${{ minHeight: 64 }} value=${learned} placeholder="One or two lines in your own words" onInput=${(e) => setLearned(e.target.value)} onBlur=${flushLearned}></textarea></label>
      <label className="f">Link (GitHub, TryHackMe, blog)<input type="url" value=${link} placeholder="https://" onInput=${(e) => setLink(e.target.value)} onBlur=${flushLink} /></label>
      ${r.link && /^https?:\/\//.test(r.link) && html`<a href=${r.link} target="_blank" rel="noopener noreferrer" className="small">Open link</a>`}
    </div></${Tile}>`;
}

/* ---------- behind-schedule meter: calm colours, no alarms ---------- */
function BehindMeter({ compact }) {
  useApp();
  const t = today(); if (!S.settings.planStart || t <= S.settings.planStart) return null;
  const b = backlog(), n = b.length, drops = dropSuggestions();
  return html`<${Tile} title="Plan pace" action=${html`<span className=${'chip ' + (n ? 'lilac' : 'good')}>${n ? `${n} day${n > 1 ? 's' : ''} behind` : 'On pace'}</span>`}>
    <div className="col">
      <div className="bar lilac" role="img" aria-label=${n ? `${n} days behind the plan` : 'On pace'}><i style=${{ width: Math.min(100, n * 6 + (n ? 6 : 100)) + '%', background: n ? 'var(--accent2)' : 'var(--good)' }}></i></div>
      ${n === 0 ? html`<p className="small muted">Everything due so far is done or caught up. Nice rhythm.</p>`
        : html`<p className="small muted">That is fine. The plan says to keep the lab days, drop the optional tasks and move on. Consistency beats speed.</p>`}
      ${!compact && n > 0 && drops.length > 0 && html`<div className="small"><strong>Optional tasks you could drop:</strong><ul style=${{ margin: '6px 0 0', paddingLeft: 18 }}>${drops.slice(0, 3).map((d) => html`<li key=${d.date}>${fmtDate(d.date)}: review day</li>`)}</ul></div>`}
      ${n > 0 && html`<button className="btn sm" onClick=${() => { setPlanView('catchup'); goTab('plan'); }}><${Icon} n="shift" />Catch-up options</button>`}
    </div></${Tile}>`;
}

/* ---------- XP / streak summary (shown on Today and Rewards) ---------- */
function ProgressTile() {
  useApp();
  const { xp, coins } = totals(), lv = levelInfo(xp), d = S.derived;
  return html`<${Tile} title="Level">
    <div className="col">
      <div className="row between wrap"><div className=${'lvlup'}><div className="big" style=${{ fontSize: 24 }}>${lv.name}</div><div className="small muted num">${xp.toLocaleString()} XP${lv.next ? ` · ${(lv.hi - xp).toLocaleString()} to ${lv.next}` : ''}</div></div></div>
      <div className="bar" role="progressbar" aria-valuenow=${Math.round(lv.pct * 100)} aria-valuemin="0" aria-valuemax="100" aria-label="XP progress to next level"><i style=${{ width: lv.pct * 100 + '%' }}></i></div>
      <div className="row wrap gap-16 small">
        <span className="row gap-6"><${Icon} n="flame" className="" /><strong className="num">${d.streak}</strong> day streak</span>
        <span className="row gap-6"><${Icon} n="shield" /><strong className="num">${d.shields}</strong>/${CONFIG.shield.max} shields</span>
        <span className="row gap-6"><${Icon} n="coin" /><strong className="num">${coins}</strong> coins</span>
      </div>
    </div></${Tile}>`;
}

/* ---------- start screen: shown until you press Start ---------- */
function StartCard() {
  const [d, setD] = useState(today()), first = S.plan[0];
  const later = d > today();
  return html`<div className="page"><div className="page-head"><div><h1>Start your roadmap</h1><p className="muted">365 days of study, labs and projects. Begin whenever you are ready.</p></div></div>
    <div className="grid2"><${Tile} title="Day 1">
      <div className="col">
        <p className="taskline">${first ? first.task : ''}</p>
        <label className="f" style=${{ maxWidth: 240 }}>Start date<input type="date" value=${d} onChange=${(e) => setD(e.target.value || today())} /></label>
        <button className="btn primary xl" style=${{ alignSelf: 'flex-start' }} onClick=${() => startPlan(d)}><${Icon} n="play" />${later ? 'Start on ' + fmtDate(d) : 'Start now'}</button>
        <p className="small muted">The plan counts from this day. You can change it later in Settings.</p>
      </div></${Tile}>
      <${Tile} title="After you start"><div className="col">
        <p className="small">Reminders run every day: study time, lab and review days, flash cards due, the daily check-in, exam countdowns and a weekly backup.</p>
        <p className="small muted">Allow notifications when your browser asks. Install the app (Settings > Install, or your browser's install button) so it opens like any other app. On Android and desktop Chrome or Edge the installed app can also remind you while it is closed. On iPhone, reminders appear when you open the app.</p>
      </div></${Tile}></div></div>`;
}
function TodayPage() { useApp(); return isStarted() ? html`<${TodayMain} />` : html`<${StartCard} />`; }

/* ---------- today ---------- */
function TodayMain() {
  useApp(); const tm = timerState(); useTick(!!(tm && tm.running));
  const t = today(), p = planFor(t), r = rec(t), st = statusOf(t), kind = dayKind(t);
  const [min, setMin] = useState(''), [mnote, setMnote] = useState(''), [ask, confirmNode] = useConfirm();
  const [resched, setResched] = useState(false), [rdate, setRdate] = useState(addDays(t, 1));
  const [custom, setCustom] = useState('');
  const sessions = S.sessions.filter((s) => s.date === t);
  const preStart = t < S.settings.planStart, ph = p && phaseOf(p.phase);
  const live = tm && tm.date === t ? tm : null;
  const customList = r.custom || [];
  const reviewDay = !!p && p.type === 'review';
  const rc = reviewDay ? recap(startOfWeek(t, S.settings.weekStart)) : null;

  return html`<div className="page">
    <div className="page-head"><div><h1>Today</h1><p className="muted">${fmtLong(t)}</p></div>
      <div className="row wrap">${p && html`<span className="chip amber">Day ${p.day} of ${S.plan.length}</span><span className="chip">Week ${p.week}</span>${ph && html`<span className="chip lilac">Phase ${ph.num}: ${ph.name}</span>`}`}
      ${isRestDay(t) && html`<span className="chip good">Rest day</span>`}</div></div>
    <${Banners} />
    <div className="grid2">
      <div className="col gap-16">
        <${Tile} title=${p ? p.weekTitle : 'Study plan'} action=${p && html`<div className="row">${typeChip(p.type)}<span className="row gap-6 small muted"><${StatusDot} st=${st} />${statusLabel[st]}</span></div>`}>
          ${preStart ? html`<div className="col"><p className="taskline">Your plan starts on ${fmtLong(S.settings.planStart)}, in ${diffDays(S.settings.planStart, t)} day${diffDays(S.settings.planStart, t) > 1 ? 's' : ''}.</p>
              ${p ? html`<p className="muted">Day 1 preview: ${p.task}</p>` : null}<p className="small muted">You can still log study time below. It counts toward your hours and XP.</p></div>`
            : p ? html`<p className="taskline">${p.task}</p>`
            : html`<p className="taskline muted">No roadmap task today.</p>`}
          <div className="col" style=${{ marginTop: 18, alignItems: 'flex-start' }}>
            <div className="timer" aria-live="off" role="timer">${fmtClock(live ? timerMs(live) : 0)}</div>
            ${tm && tm.date !== t && html`<p className="small muted">A timer from ${fmtDate(tm.date)} is still open. Stop it to log that session.</p>`}
            <div className="row wrap">
              ${!tm ? html`<button className="btn primary xl" onClick=${timerStart}><${Icon} n="play" />Start <span className="kbd" style=${{ color: 'var(--accent-ink)', background: 'transparent', borderColor: 'currentColor' }}>S</span></button>`
                : html`${tm.running ? html`<button className="btn xl" onClick=${timerPause}><${Icon} n="pause" />Pause</button>` : html`<button className="btn primary xl" onClick=${timerResume}><${Icon} n="play" />Resume</button>`}
                  <button className="btn xl" onClick=${() => timerStop(false)}><${Icon} n="stop" />Stop</button>
                  <button className="btn ghost" onClick=${() => ask('Discard this timer?', 'The running session will not be logged.', 'Discard', () => timerStop(true))}>Discard</button>`}
            </div>
          </div>
          ${p && html`<div className="hr" style=${{ margin: '18px 0 6px' }}></div>
            <label className="check"><input type="checkbox" checked=${r.status === 'done'} onChange=${() => completeDay(t)} /><span><strong>Mark complete</strong> <span className="kbd">C</span><span className="small muted" style=${{ display: 'block' }}>${isLabLike(p.type) ? `Lab and project days pay ${CONFIG.xp.labOrProject} XP once you log a timer session or add a note.` : `+${baseXp(p.type)} XP${isComeback(t) ? ` (x${CONFIG.comebackMultiplier} comeback bonus)` : ''}`}</span></span></label>
            ${r.status === 'done' && isLabLike(p.type) && !hasEvidence(t) && html`<p className="chip lilac" style=${{ alignSelf: 'flex-start' }}>Add a note or a timer session to earn the XP</p>`}
            <div className="row wrap">
              <button className="btn sm" onClick=${() => skipDay(t)}><${Icon} n="skip" />${r.status === 'skipped' ? 'Undo skip' : 'Skip today'}</button>
              <button className="btn sm" onClick=${() => setResched(!resched)}><${Icon} n="swap" />Reschedule</button>
              <button className="btn sm" onClick=${() => toggleRestDay(t)} disabled=${t < today()}><${Icon} n="rest" />${isRestDay(t) ? 'Remove rest day' : 'Mark rest day'}</button>
            </div>
            ${resched && html`<div className="row wrap"><input type="date" value=${rdate} min=${addDays(t, 1)} onChange=${(e) => setRdate(e.target.value)} style=${{ width: 'auto' }} aria-label="Swap with date" />
              <button className="btn primary sm" onClick=${() => { rescheduleDay(t, rdate); setResched(false); }}>Swap tasks</button><span className="small muted">Swaps today's task with that day's task.</span></div>`}`}
        </${Tile}>

        <${Tile} title="Time today" action=${html`<span className="num small">${fmtMin(minutesOn(t))} · ${Math.min(minutesOn(t), CONFIG.xp.minuteCapPerDay)} XP</span>`}>
          ${sessions.length ? sessions.map((s) => html`<div key=${s.id} className="session"><span><span className="num">${fmtMin(s.minutes)}</span> <span className="muted small">${s.kind === 'timer' ? new Date(s.startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' – ' + new Date(s.endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'manual' + (s.note ? ': ' + s.note : '')}</span></span>
            <button className="btn sm icon ghost" aria-label="Delete session" onClick=${() => ask('Delete this session?', 'Its minutes and XP will be removed.', 'Delete', () => deleteSession(s.id))}><${Icon} n="trash" /></button></div>`)
            : html`<${Empty}>No sessions yet. Press Start when you sit down to study.<//>`}
          <form className="row wrap" style=${{ marginTop: 12 }} onSubmit=${(e) => { e.preventDefault(); addManual(t, min, mnote); setMin(''); setMnote(''); }}>
            <label className="f" style=${{ width: 110 }}>Minutes<input type="number" min="1" max="180" inputMode="numeric" value=${min} onInput=${(e) => setMin(e.target.value)} /></label>
            <label className="f grow" style=${{ minWidth: 140 }}>Note (optional)<input type="text" value=${mnote} onInput=${(e) => setMnote(e.target.value)} /></label>
            <button className="btn" type="submit" style=${{ alignSelf: 'flex-end' }}><${Icon} n="plus" />Add time</button>
          </form>
          <p className="xs muted" style=${{ marginTop: 8 }}>Manual time is capped at ${CONFIG.manualMinutesCapPerDay / 60} hours per day (${manualOn(t)} min used). XP is ${CONFIG.xp.perMinute} per minute, up to ${CONFIG.xp.minuteCapPerDay} a day.</p>
        </${Tile}>
        ${confirmNode}
      </div>

      <div className="col gap-16">
        <${ProgressTile} /><${BehindMeter} />
        ${rc && html`<${Tile} title="Weekly recap" action=${html`<span className="chip lilac">Review day</span>`}><${RecapBody} rc=${rc} /></${Tile}>`}
        <${CheckinNudge} />
        <${NotesTile} date=${t} />
        <${Tile} title="Extra tasks for today">
          ${customList.length ? customList.map((c) => html`<div key=${c.id} className="row between"><label className="check grow"><input type="checkbox" checked=${c.done} onChange=${() => toggleCustom(t, c.id)} /><span style=${{ textDecoration: c.done ? 'line-through' : 'none' }}>${c.text}</span></label>
            <button className="btn sm icon ghost" aria-label=${'Remove ' + c.text} onClick=${() => removeCustom(t, c.id)}><${Icon} n="x" /></button></div>`) : html`<p className="small muted">Add your own tasks here. Custom tasks do not earn XP.</p>`}
          <form className="row" style=${{ marginTop: 8 }} onSubmit=${(e) => { e.preventDefault(); addCustomTask(t, custom); setCustom(''); }}>
            <input type="text" aria-label="New task" placeholder="New task" value=${custom} onInput=${(e) => setCustom(e.target.value)} /><button className="btn" type="submit" aria-label="Add task"><${Icon} n="plus" /></button></form>
        </${Tile}>
      </div>
    </div></div>`;
}

function CheckinNudge() {
  const t = today(), c = S.checkins[t], h = new Date().getHours();
  if (!planFor(t) && !c) return null;
  return html`<${Tile} title="Daily check-in" action=${c ? html`<span className="chip good">Done +${CONFIG.xp.checkin} XP</span>` : null}>
    <p className="small muted">${c ? 'Saved. See you tomorrow.' : h >= 18 ? 'Day end is a good time: what did you finish, what blocked you, what is next?' : 'You can do this at day end. It takes a minute.'}</p>
    ${!c && html`<button className="btn sm" style=${{ marginTop: 8, alignSelf: 'flex-start' }} onClick=${() => { setQuizView('checkin'); goTab('quiz'); }}>Open check-in</button>`}</${Tile}>`;
}

function RecapBody({ rc }) {
  return html`<div className="col">
    <div className="fgrid" style=${{ gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8 }}>
      ${[['XP', '+' + rc.xp], ['Coins', '+' + rc.gained + (rc.lost ? ' / −' + rc.lost : '')], ['Hours', (rc.minutes / 60).toFixed(1)], ['Tasks', rc.tasks + '/' + rc.planned], ['Streak', rc.streak], ['Shields', rc.shields]].map(([k, v]) =>
        html`<div key=${k}><div className="xs muted">${k}</div><div className="num" style=${{ fontWeight: 600, fontSize: 17 }}>${v}</div></div>`)}</div>
    <p className="small"><strong>Win:</strong> ${rc.win}</p><p className="small"><strong>To try:</strong> ${rc.improve}</p></div>`;
}

/* ---------- plan ---------- */
let planViewSetter = null; let quizViewSetter = null;
const setPlanView = (v) => { try { sessionStorage.setItem('planView', v); } catch (e) { /* ignore */ } if (planViewSetter) planViewSetter(v); };
const setQuizView = (v) => { try { sessionStorage.setItem('quizView', v); } catch (e) { /* ignore */ } if (quizViewSetter) quizViewSetter(v); };
const readSS = (k, d) => { try { return sessionStorage.getItem(k) || d; } catch (e) { return d; } };

function DayPanel({ date, onClose }) {
  useApp(); const [ask, node] = useConfirm();
  const p = planFor(date), st = statusOf(date), r = rec(date);
  const [resched, setResched] = useState(false), [rd, setRd] = useState(addDays(date, 1));
  const ph = p && phaseOf(p.phase);
  return html`<${Tile} title=${fmtLong(date)} action=${html`<button className="btn sm icon ghost" aria-label="Close details" onClick=${onClose}><${Icon} n="x" /></button>`}>
    <div className="col">
      ${p ? html`<div className="row wrap">${typeChip(p.type)}<span className="chip">Day ${p.day}</span><span className="chip">Week ${p.week}</span>${ph && html`<span className="chip lilac">${ph.name}</span>`}<span className="row gap-6 small muted"><${StatusDot} st=${st} />${statusLabel[st]}</span>${isRestDay(date) && html`<span className="chip good">Rest day</span>`}</div>
        <p className="taskline">${p.task}</p><p className="small muted">${p.weekTitle}</p>`
        : html`<p className="muted">No roadmap task on this date.</p>`}
      <div className="row wrap">
        ${p && html`<button className="btn sm" onClick=${() => completeDay(date)}><${Icon} n="check" />${r.status === 'done' ? 'Undo done' : 'Mark done'}</button>
          <button className="btn sm" onClick=${() => skipDay(date)}><${Icon} n="skip" />${r.status === 'skipped' ? 'Undo skip' : 'Skip'}</button>
          <button className="btn sm" onClick=${() => setResched(!resched)}><${Icon} n="swap" />Reschedule</button>`}
        ${p && html`<button className="btn sm" disabled=${date < today() && !isRestDay(date)} onClick=${() => toggleRestDay(date)}><${Icon} n="rest" />${isRestDay(date) ? 'Remove rest day' : 'Rest day'}</button>`}
        ${date === today() && html`<button className="btn sm primary" onClick=${() => goTab('today')}>Open Today</button>`}
      </div>
      ${resched && html`<div className="row wrap"><input type="date" value=${rd} onChange=${(e) => setRd(e.target.value)} style=${{ width: 'auto' }} aria-label="Swap with date" /><button className="btn primary sm" onClick=${() => { rescheduleDay(date, rd); setResched(false); }}>Swap tasks</button></div>`}
      <p className="small muted">Time logged: ${fmtMin(minutesOn(date))}${r.learned ? ' · Learned: ' + r.learned : ''}</p>
      ${(r.custom || []).length > 0 && html`<p className="small muted">Extra tasks: ${r.custom.map((c) => (c.done ? '✓ ' : '') + c.text).join(', ')}</p>`}
    </div>${node}</${Tile}>`;
}

function PlanPage() { useApp(); return isStarted() ? html`<${PlanMain} />` : html`<${StartCard} />`; }
function PlanMain() {
  useApp();
  const [view, setView] = useState(readSS('planView', 'week')); planViewSetter = setView;
  const t = today(), base = t < S.settings.planStart ? S.settings.planStart : t;
  const [focus, setFocus] = useState(base), [sel, setSel] = useState(null);
  const [q, setQ] = useState(''), [ft, setFt] = useState(''), [fs, setFs] = useState(''), [fp, setFp] = useState('');
  return html`<div className="page">
    <div className="page-head"><div><h1>Plan</h1><p className="muted">${fmtLong(S.settings.planStart)} to ${fmtLong(planEnd())}</p></div></div>
    <${SubTabs} value=${view} onChange=${(v) => { setView(v); setSel(null); }} options=${[['week', 'Week'], ['month', 'Month'], ['all', 'All days'], ['catchup', 'Catch-up']]} />
    ${view === 'week' && html`<${WeekView} focus=${focus} setFocus=${setFocus} sel=${sel} setSel=${setSel} />`}
    ${view === 'month' && html`<${MonthView} focus=${focus} setFocus=${setFocus} sel=${sel} setSel=${setSel} />`}
    ${view === 'all' && html`<${AllView} q=${q} setQ=${setQ} ft=${ft} setFt=${setFt} fs=${fs} setFs=${setFs} fp=${fp} setFp=${setFp} sel=${sel} setSel=${setSel} />`}
    ${view === 'catchup' && html`<${CatchUp} />`}
    ${sel && view !== 'catchup' && html`<${DayPanel} date=${sel} onClose=${() => setSel(null)} />`}
  </div>`;
}
function WeekView({ focus, setFocus, sel, setSel }) {
  const ws = startOfWeek(focus, S.settings.weekStart), t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const p0 = planFor(days.find((d) => planFor(d)) || ws);
  return html`<div className="col">
    <div className="row between wrap"><div className="row"><button className="btn sm icon" aria-label="Previous week" onClick=${() => setFocus(addDays(ws, -7))}><${Icon} n="left" /></button><strong>${fmtDate(days[0])} – ${fmtDate(days[6])}</strong><button className="btn sm icon" aria-label="Next week" onClick=${() => setFocus(addDays(ws, 7))}><${Icon} n="right" /></button></div>
      <div className="row"><span className="small muted">${p0 ? 'Week ' + p0.week + ': ' + p0.weekTitle : ''}</span><button className="btn sm" onClick=${() => setFocus(t < S.settings.planStart ? S.settings.planStart : t)}>This week</button></div></div>
    <div className="weekgrid">${days.map((d) => { const p = planFor(d), st = statusOf(d);
      return html`<button key=${d} className=${'daycard' + (d === t ? ' today' : '')} aria-pressed=${sel === d} onClick=${() => setSel(sel === d ? null : d)} style=${sel === d ? { background: 'var(--muted)' } : null}>
        <div className="row between"><strong className="small">${fmtDate(d)}</strong>${p && html`<${StatusDot} st=${st} />`}</div>
        ${p ? html`<div className="row wrap" style=${{ gap: 4 }}>${typeChip(p.type)}${isRestDay(d) && html`<span className="chip good">rest</span>`}</div><p>${p.task.length > 90 ? p.task.slice(0, 88) + '…' : p.task}</p>` : html`<p>No task</p>`}</button>`; })}</div></div>`;
}
function MonthView({ focus, setFocus, sel, setSel }) {
  const d0 = parseYmd(focus), first = ymd(new Date(d0.getFullYear(), d0.getMonth(), 1, 12)), t = today();
  const gs = startOfWeek(first, S.settings.weekStart), cells = Array.from({ length: 42 }, (_, i) => addDays(gs, i));
  const names = Array.from({ length: 7 }, (_, i) => DOWS[(S.settings.weekStart + i) % 7]);
  const rest = (S.kv.restDays || []).filter((d) => d.slice(0, 7) === first.slice(0, 7)).length;
  const prev = ymd(new Date(d0.getFullYear(), d0.getMonth() - 1, 1, 12)), next = ymd(new Date(d0.getFullYear(), d0.getMonth() + 1, 1, 12));
  return html`<div className="col"><div className="row between wrap"><div className="row"><button className="btn sm icon" aria-label="Previous month" onClick=${() => setFocus(prev)}><${Icon} n="left" /></button><strong>${MONTHS[d0.getMonth()]} ${d0.getFullYear()}</strong><button className="btn sm icon" aria-label="Next month" onClick=${() => setFocus(next)}><${Icon} n="right" /></button></div>
    <span className="small muted">Rest days: ${rest}/${CONFIG.restDaysPerMonth}</span></div>
    <div className="month">${names.map((n) => html`<div key=${n} className="mhead">${n}</div>`)}
      ${cells.map((d) => { const inM = d.slice(0, 7) === first.slice(0, 7), p = planFor(d);
        return html`<button key=${d} className=${'mcell' + (inM ? '' : ' dim') + (d === t ? ' today' : '') + (sel === d ? ' sel' : '')} aria-label=${fmtLong(d) + (p ? ', ' + statusLabel[statusOf(d)] : '')} onClick=${() => setSel(sel === d ? null : d)}>
          <span>${parseYmd(d).getDate()}</span>${p ? html`<${StatusDot} st=${isRestDay(d) ? 'done' : statusOf(d)} />` : html`<span style=${{ height: 7 }}></span>`}</button>`; })}</div></div>`;
}
function AllView({ q, setQ, ft, setFt, fs, setFs, fp, setFp, sel, setSel }) {
  const t = today(), n = diffDays(planEnd(), S.settings.planStart) + 1;
  const rows = useMemo(() => {
    const out = [], needle = q.trim().toLowerCase();
    for (let i = 0; i < n; i++) {
      const d = addDays(S.settings.planStart, i), p = planFor(d); if (!p) continue;
      const st = statusOf(d);
      if (ft && p.type !== ft) continue; if (fs && st !== fs) continue; if (fp && String(p.phase) !== fp) continue;
      if (needle && !(p.task + ' ' + p.weekTitle + ' ' + fmtDate(d)).toLowerCase().includes(needle)) continue;
      out.push({ d, p, st });
    }
    return out;
  }, [q, ft, fs, fp, n, version]);
  return html`<div className="col">
    <div className="fgrid"><label className="f">Search<div style=${{ position: 'relative' }}><input type="search" value=${q} placeholder="Search tasks, weeks, dates" onInput=${(e) => setQ(e.target.value)} /></div></label>
      <label className="f">Type<select value=${ft} onChange=${(e) => setFt(e.target.value)}><option value="">All types</option>${['study', 'lab', 'project', 'review', 'exam', 'rest'].map((x) => html`<option key=${x} value=${x}>${x}</option>`)}</select></label>
      <label className="f">Status<select value=${fs} onChange=${(e) => setFs(e.target.value)}><option value="">Any status</option>${Object.entries(statusLabel).map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)}</select></label>
      <label className="f">Phase<select value=${fp} onChange=${(e) => setFp(e.target.value)}><option value="">All phases</option>${S.phases.map((p) => html`<option key=${p.num} value=${p.num}>${p.num}. ${p.name}</option>`)}</select></label></div>
    <p className="small muted">${rows.length} day${rows.length === 1 ? '' : 's'}</p>
    <div>${rows.length ? rows.map(({ d, p, st }) => html`<button key=${d} className=${'listrow' + (d === t ? ' today' : '')} onClick=${() => setSel(sel === d ? null : d)}>
      <${StatusDot} st=${st} /><span className="num small">${fmtDate(d)}</span><span style=${{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${p.task}</span>${typeChip(p.type)}</button>`) : html`<${Empty}>No days match these filters.<//>`}</div></div>`;
}
function CatchUp() {
  useApp(); const [drop, setDrop] = useState(true); const [ask, node] = useConfirm();
  const b = backlog(), drops = dropSuggestions().filter((x) => x.date >= today());
  const shifts = S.kv.shifts || [];
  return html`<div className="grid2 even"><${Tile} title="Catch-up mode" action=${html`<span className=${'chip ' + (b.length ? 'lilac' : 'good')}>${b.length ? b.length + ' unfinished' : 'On pace'}</span>`}>
      <div className="col">
        <p className="small muted">Catch-up moves the rest of the plan forward so today shows the first unfinished task. Nothing is deleted. Past days keep their history.</p>
        ${b.length ? html`<div><strong className="small">Unfinished days</strong><ul className="small" style=${{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 220, overflow: 'auto' }}>${b.map((x) => html`<li key=${x.date}>${fmtDate(x.date)}: ${x.plan.task.length > 70 ? x.plan.task.slice(0, 68) + '…' : x.plan.task}</li>`)}</ul></div>` : html`<p className="small">You are on pace. Nothing to shift.</p>`}
        ${drops.length > 0 && html`<label className="check"><input type="checkbox" checked=${drop} onChange=${(e) => setDrop(e.target.checked)} /><span>Also drop ${drops.length} upcoming review day${drops.length > 1 ? 's' : ''} (optional tasks)</span></label>`}
        <button className="btn primary" disabled=${!b.length} onClick=${() => ask('Shift the plan forward?', `The plan moves ${b.length} day${b.length > 1 ? 's' : ''} later. Your exam dates in Certs do not change, so check them afterwards.`, 'Shift plan', () => catchUp(drop))}><${Icon} n="shift" />Shift plan forward</button>
      </div></${Tile}>
    <${Tile} title="Rest days and shifts"><div className="col">
      <p className="small muted">Pre-mark up to ${CONFIG.restDaysPerMonth} rest days per month from the Week or Month view (open a day, then Rest day). They never break your streak or cost coins.</p>
      <p className="small"><strong>Marked rest days:</strong> ${(S.kv.restDays || []).length ? (S.kv.restDays || []).map(fmtDate).join(', ') : 'none'}</p>
      <p className="small"><strong>Plan shifts so far:</strong> ${shifts.length ? shifts.map((s) => `${s.by} day${s.by > 1 ? 's' : ''} from ${fmtDate(s.from)}`).join('; ') : 'none'}</p>
      ${shifts.length > 0 && html`<button className="btn sm danger" style=${{ alignSelf: 'flex-start' }} onClick=${() => ask('Undo all shifts?', 'The plan goes back to the original dates.', 'Undo shifts', () => { setKv('shifts', []); refresh([]); })}>Undo all shifts</button>`}</div></${Tile}>${node}</div>`;
}
