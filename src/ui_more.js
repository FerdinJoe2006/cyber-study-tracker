/* =====================================================================
   STUDY TRACKER - ui_more.js   Quiz, Rewards, Certs & Projects, Settings
   ===================================================================== */

/* an input that keeps its own draft and saves on blur (used for long forms) */
function DraftField({ label, value, onSave, type, multiline, placeholder, min, max }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  const commit = () => { if (String(v) !== String(value ?? '')) onSave(v); };
  return html`<label className="f">${label}${multiline
    ? html`<textarea value=${v} placeholder=${placeholder} style=${{ minHeight: 64 }} onInput=${(e) => setV(e.target.value)} onBlur=${commit}></textarea>`
    : html`<input type=${type || 'text'} value=${v} min=${min} max=${max} placeholder=${placeholder} onInput=${(e) => setV(e.target.value)} onBlur=${commit} />`}</label>`;
}

/* =============================== QUIZ ================================ */
function QuizPage() {
  useApp();
  const [view, setView] = useState(readSS('quizView', 'study')); quizViewSetter = setView;
  return html`<div className="page"><div className="page-head"><div><h1>Quiz</h1><p className="muted">${dueCards().length} card${dueCards().length === 1 ? '' : 's'} due today · ${S.cards.length} in your deck</p></div></div>
    <${SubTabs} value=${view} onChange=${setView} options=${[['study', 'Flash cards'], ['cards', 'Deck'], ['checkin', 'Daily check-in'], ['practice', 'Exam practice']]} />
    ${view === 'study' && html`<${StudyView} />`}${view === 'cards' && html`<${DeckView} />`}${view === 'checkin' && html`<${CheckinView} />`}${view === 'practice' && html`<${PracticeView} />`}</div>`;
}

function StudyView() {
  const reduced = useReducedMotion();
  const [run, setRun] = useState(null);   // {queue, flipped, total, correct, retry:Set}
  const hist = S.quizSessions.slice(-8).reverse();
  /* each card is a multiple-choice question (the right answer plus three other cards' answers), so XP is only paid for answers you really know. Decks too small for that fall back to self-grading. */
  const withOpts = (r) => { const c = r.queue.length ? S.cards.find((x) => x.id === r.queue[0]) : null; return { ...r, picked: null, opts: c ? mcqOptions(c) : null }; };
  const start = () => { const ids = shuffle(dueCards()).slice(0, 30).map((c) => c.id); if (ids.length) setRun(withOpts({ queue: ids, flipped: false, total: 0, correct: 0, retry: [] })); };
  const card = run && run.queue.length ? S.cards.find((c) => c.id === run.queue[0]) : null;
  const answer = (ok) => {
    const id = run.queue[0], first = !run.retry.includes(id);
    answerCard(card, ok, first);
    let queue = run.queue.slice(1), retry = run.retry;
    if (!ok) { queue = [...queue.slice(0, 3), id, ...queue.slice(3)]; retry = [...retry, id]; }   // wrong answers come back sooner
    const next = { queue, flipped: false, retry, total: run.total + (first ? 1 : 0), correct: run.correct + (first && ok ? 1 : 0) };
    if (!queue.length) { finishQuizSession(next.total, next.correct); setRun({ ...next, done: true }); } else setRun(withOpts(next));
  };
  useEffect(() => {
    if (!run || run.done) return;
    const f = (e) => { if (S.verifyReq || /input|textarea|select/i.test(e.target.tagName)) return;
      if (run.opts) {
        if (run.picked === null && /^[1-4]$/.test(e.key) && run.opts[Number(e.key) - 1]) setRun((r) => ({ ...r, picked: Number(e.key) - 1 }));
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (run.picked === null) setRun((r) => ({ ...r, picked: -1 })); else answer(run.picked >= 0 && run.opts[run.picked].ok); }
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRun((r) => ({ ...r, flipped: true })); }
      if (run.flipped && e.key === '1') answer(false); if (run.flipped && e.key === '2') answer(true); };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  });
  return html`<div className="grid2"><div className="col gap-16">
    ${!run && html`<${Tile} title="Self-test"><div className="col"><p className="taskline">${dueCards().length ? `${dueCards().length} card${dueCards().length > 1 ? 's are' : ' is'} ready.` : 'No cards due right now.'}</p>
      <p className="small muted">Pick the right answer from four choices. Right answers move up a Leitner box and return later (1, 2, 4, 8, 16 days). Wrong answers drop to box 1 and come back in this session. Each correct card earns ${CONFIG.xp.quizCorrect} XP, plus ${CONFIG.xp.quizWrongBonus} if you missed it on an earlier day.</p>
      ${S.settings.introduceByWeek && html`<p className="xs muted">Cards unlock as their roadmap week arrives (turn this off in Settings).</p>`}
      <button className="btn primary xl" style=${{ alignSelf: 'flex-start' }} disabled=${!dueCards().length} onClick=${start}><${Icon} n="play" />Start session</button></div></${Tile}>`}
    ${run && run.done && html`<${Tile} title="Session complete"><div className="col"><div className="big">${run.correct}/${run.total}</div><p className="muted">${run.total ? Math.round((run.correct / run.total) * 100) : 0}% right on the first try. Cards you missed are scheduled for tomorrow.</p><button className="btn primary" onClick=${() => setRun(null)}>Done</button></div></${Tile}>`}
    ${run && card && !run.done && html`<${Tile} title=${`Card ${run.total + 1} · ${run.queue.length} left`} action=${html`<span className="chip">${card.topic} · box ${card.box}</span>`}>
      <div className=${'flip' + (run.flipped ? ' on' : '') + (reduced ? ' nomo' : '')}><div className="flip-in">
        <div className="face front" aria-hidden=${run.flipped}><span className="xs muted">Question</span>${card.front}</div>
        <div className="face back" aria-hidden=${!run.flipped}><span className="xs muted">Answer</span>${card.back}</div></div></div>
      ${run.opts ? html`<div className="col gap-6" style=${{ marginTop: 14 }}>
        ${run.opts.map((o, i) => html`<button type="button" key=${i} className=${'opt' + (run.picked !== null ? (o.ok ? ' right' : run.picked === i ? ' wrong' : '') : '')} disabled=${run.picked !== null} onClick=${() => setRun({ ...run, picked: i })}><span className="kbd">${i + 1}</span> ${o.text}</button>`)}
        ${run.picked === null ? html`<button type="button" className="btn sm ghost" style=${{ alignSelf: 'flex-start' }} onClick=${() => setRun({ ...run, picked: -1 })}>I don't know <span className="kbd">Space</span></button>`
          : html`<div className="row between wrap"><span className=${'chip ' + (run.picked >= 0 && run.opts[run.picked].ok ? 'good' : 'lilac')}>${run.picked >= 0 && run.opts[run.picked].ok ? 'Correct' : 'Not quite. The right answer is highlighted.'}</span><button type="button" className="btn primary xl" autoFocus onClick=${() => answer(run.picked >= 0 && run.opts[run.picked].ok)}>Next <span className="kbd">Space</span></button></div>`}</div>` : null}
      ${!run.opts && html`<div className="row between wrap" style=${{ marginTop: 14 }}>
        ${!run.flipped ? html`<button className="btn primary xl grow" onClick=${() => setRun({ ...run, flipped: true })}>Show answer <span className="kbd">Space</span></button>`
          : html`<button className="btn xl grow" onClick=${() => answer(false)}>Missed it <span className="kbd">1</span></button><button className="btn primary xl grow" onClick=${() => answer(true)}>Got it <span className="kbd">2</span></button>`}</div>`}
      <div style=${{ marginTop: 12 }}><button className="btn sm ghost" onClick=${() => { if (run.total) finishQuizSession(run.total, run.correct); setRun(null); }}>End session</button></div></${Tile}>`}
  </div>
  <${Tile} title="Score history">${hist.length ? html`<div className="col"><div className="strip" style=${{ minHeight: 70, alignItems: 'flex-end' }}>${hist.slice().reverse().map((h) => html`<div key=${h.id} title=${`${h.correct}/${h.total}`} style=${{ flex: 1, height: Math.max(8, (h.correct / h.total) * 100) + '%', background: 'var(--accent2)', borderRadius: 4 }}></div>`)}</div>
    <table className="t"><thead><tr><th>Date</th><th>Score</th><th>Cards</th></tr></thead><tbody>${hist.map((h) => html`<tr key=${h.id}><td>${fmtDate(h.date)}</td><td className="num">${Math.round((h.correct / h.total) * 100)}%</td><td className="num">${h.correct}/${h.total}</td></tr>`)}</tbody></table>
    <p className="xs muted">${S.reviews.length} cards answered in total (badge at ${CONFIG.quizBadgeTarget}).</p></div>` : html`<${Empty}>Your session scores will appear here.<//>`}</${Tile}></div>`;
}

function DeckView() {
  const [q, setQ] = useState(''), [f, setF] = useState({ front: '', back: '', topic: '', week: '' }), [edit, setEdit] = useState(null), [ask, node] = useConfirm(), [lim, setLim] = useState(30);
  const list = S.cards.filter((c) => !q || (c.front + c.back + c.topic).toLowerCase().includes(q.toLowerCase()));
  const saveNew = (e) => { e.preventDefault(); if (!f.front.trim() || !f.back.trim()) return toast('Add both a question and an answer.', 'error');
    const c = { id: 'c' + uid(), front: f.front.trim(), back: f.back.trim(), topic: f.topic.trim() || 'General', week: f.week === '' ? null : Number(f.week), box: 1, due: today(), reps: 0, lapses: 0, lastWrongDate: null, source: 'mine' };
    S.cards.push(c); save('cards', c); setF({ front: '', back: '', topic: '', week: '' }); toast('Card added.', 'good'); commit(); };
  const importText = async (file) => {
    const txt = await file.text(); let rows = [];
    try {
      if (file.name.endsWith('.json')) { const j = JSON.parse(txt); rows = j.map((x) => Array.isArray(x) ? { q: x[0], a: x[1], topic: x[2] } : { q: x.q || x.front, a: x.a || x.back, topic: x.topic, week: x.week }); }
      else rows = txt.split(/\r?\n/).filter(Boolean).map((l) => { const m = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((s) => s.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')); return { q: m[0], a: m[1], topic: m[2] }; });
    } catch (e) { return toast('Could not read that file. Use JSON ([{q,a,topic}]) or CSV (question,answer,topic).', 'error'); }
    const ok = rows.filter((r) => r.q && r.a); const cards = ok.map((r) => ({ id: 'c' + uid(), front: String(r.q), back: String(r.a), topic: r.topic || 'Imported', week: r.week ?? null, box: 1, due: today(), reps: 0, lapses: 0, lastWrongDate: null, source: 'import' }));
    S.cards.push(...cards); await DB.putMany('cards', cards).catch(dbFail('import cards')); toast(`Imported ${cards.length} cards.`, 'good'); commit();
  };
  return html`<div className="grid2"><${Tile} title="Add a card"><form className="col" onSubmit=${saveNew}>
      <label className="f">Question<textarea style=${{ minHeight: 64 }} value=${f.front} onInput=${(e) => setF({ ...f, front: e.target.value })}></textarea></label>
      <label className="f">Answer<textarea style=${{ minHeight: 64 }} value=${f.back} onInput=${(e) => setF({ ...f, back: e.target.value })}></textarea></label>
      <div className="fgrid"><label className="f">Topic<input type="text" value=${f.topic} onInput=${(e) => setF({ ...f, topic: e.target.value })} /></label>
        <label className="f">Unlock in roadmap week (optional)<input type="number" min="0" max="52" value=${f.week} onInput=${(e) => setF({ ...f, week: e.target.value })} /></label></div>
      <button className="btn primary" type="submit"><${Icon} n="plus" />Add card</button>
      <div className="hr"></div>
      <div className="row wrap"><label className="btn sm"><${Icon} n="upload" />Import CSV / JSON<input type="file" accept=".csv,.json" className="sr" onChange=${(e) => e.target.files[0] && importText(e.target.files[0])} /></label>
        <button type="button" className="btn sm" onClick=${() => download('flash-cards.json', JSON.stringify(S.cards.map((c) => ({ q: c.front, a: c.back, topic: c.topic, week: c.week })), null, 1), 'application/json')}><${Icon} n="download" />Export deck</button></div>
      <p className="xs muted">The ${S.cards.filter((c) => c.source === 'starter').length} starter cards were written for the weekly themes of your roadmap. Edit or delete any of them.</p></form></${Tile}>
    <${Tile} title=${`Deck (${list.length})`}><div className="col"><input type="search" aria-label="Search cards" placeholder="Search cards" value=${q} onInput=${(e) => setQ(e.target.value)} />
      ${list.slice(0, lim).map((c) => edit === c.id ? html`<${CardEditor} key=${c.id} card=${c} done=${() => setEdit(null)} />` : html`<div key=${c.id} className="session" style=${{ alignItems: 'flex-start' }}><div className="grow"><div className="small"><strong>${c.front}</strong></div><div className="xs muted">${c.topic}${c.week != null ? ' · week ' + c.week : ''} · box ${c.box} · due ${fmtDate(c.due)}</div></div>
        <div className="row" style=${{ gap: 4 }}><button className="btn sm icon ghost" aria-label="Edit card" onClick=${() => setEdit(c.id)}><${Icon} n="edit" /></button><button className="btn sm icon ghost" aria-label="Delete card" onClick=${() => ask('Delete this card?', c.front, 'Delete', () => { S.cards = S.cards.filter((x) => x.id !== c.id); remove('cards', c.id); commit(); })}><${Icon} n="trash" /></button></div></div>`)}
      ${list.length > lim && html`<button className="btn sm" onClick=${() => setLim(lim + 40)}>Show more</button>`}</div></${Tile}>${node}</div>`;
}
function CardEditor({ card, done }) {
  const [c, setC] = useState(card);
  return html`<div className="col" style=${{ padding: '8px 0' }}><textarea aria-label="Question" value=${c.front} onInput=${(e) => setC({ ...c, front: e.target.value })} style=${{ minHeight: 56 }}></textarea><textarea aria-label="Answer" value=${c.back} onInput=${(e) => setC({ ...c, back: e.target.value })} style=${{ minHeight: 56 }}></textarea>
    <div className="row"><button className="btn primary sm" onClick=${() => { const i = S.cards.findIndex((x) => x.id === c.id); S.cards[i] = c; save('cards', c); commit(); done(); }}>Save</button><button className="btn sm ghost" onClick=${done}>Cancel</button></div></div>`;
}

function CheckinView() {
  const t = today(); const ex = S.checkins[t] || {};
  const [f, setF] = useState({ finished: ex.finished || '', blocked: ex.blocked || '', tomorrow: ex.tomorrow || '', focus: ex.focus || 0 });
  const past = Object.values(S.checkins).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  return html`<div className="grid2"><${Tile} title=${'Check-in for ' + fmtDate(t)} action=${S.checkins[t] && html`<span className="chip good">Saved</span>`}><form className="col" onSubmit=${(e) => { e.preventDefault(); if (!f.finished.trim() || !f.focus) return toast('Add what you finished and a focus rating.', 'error'); saveCheckin(t, f); }}>
      <label className="f">What did I finish?<textarea value=${f.finished} onInput=${(e) => setF({ ...f, finished: e.target.value })}></textarea></label>
      <label className="f">What blocked me?<textarea value=${f.blocked} onInput=${(e) => setF({ ...f, blocked: e.target.value })}></textarea></label>
      <label className="f">What will I do tomorrow?<textarea value=${f.tomorrow} onInput=${(e) => setF({ ...f, tomorrow: e.target.value })}></textarea></label>
      <div className="f" role="group" aria-label="Focus rating 1 to 5"><span>Focus today (1 low, 5 high)</span><div className="stars">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" key=${n} aria-pressed=${f.focus === n} onClick=${() => setF({ ...f, focus: n })}>${n}</button>`)}</div></div>
      <button className="btn primary" type="submit"><${Icon} n="check" />Save check-in (+${CONFIG.xp.checkin} XP)</button></form></${Tile}>
    <${Tile} title="Recent check-ins">${past.length ? past.map((c) => html`<div key=${c.date} className="session" style=${{ display: 'block' }}><div className="row between"><strong className="small">${fmtDate(c.date)}</strong><span className="chip">Focus ${c.focus}/5</span></div><p className="small">${c.finished}</p>${c.blocked && html`<p className="xs muted">Blocked: ${c.blocked}</p>`}${c.tomorrow && html`<p className="xs muted">Next: ${c.tomorrow}</p>`}</div>`) : html`<${Empty}>No check-ins yet.<//>`}</${Tile}></div>`;
}

function PracticeView() {
  const [f, setF] = useState({ exam: S.certs[0] ? S.certs[0].name : '', date: today(), score: '', weak: '', notes: '' }); const [ask, node] = useConfirm();
  const weak = {}; S.practice.forEach((p) => (p.weak || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).forEach((w) => (weak[w] = (weak[w] || 0) + 1)));
  const topWeak = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return html`<div className="grid2"><${Tile} title="Log a practice test"><form className="col" onSubmit=${(e) => { e.preventDefault(); const s = Number(f.score); if (!(s >= 0 && s <= 100)) return toast('Enter a score between 0 and 100.', 'error'); const done = (v) => { addPractice(f, v); setF({ ...f, score: '', weak: '', notes: '' }); toast(s >= 80 ? `Verified and logged. ${CONFIG.xp.practiceExam80} XP for 80%+.` : 'Practice test logged.', 'good'); };
      if (s >= 80) requestVerify({ kind: 'practice', title: 'Verify this practice score', sub: `${f.exam} · ${s}% on ${fmtDate(f.date)}`, reward: `+${CONFIG.xp.practiceExam80} XP`, proof: { min: CONFIG.verify.otherProofMin, label: 'Proof: where you took it and the attempt or report ID', placeholder: 'Example: Professor Messer practice exam 2, attempt on 12 Mar, 84/100.' }, link: { label: 'Link or screenshot reference (optional)' }, attest: 'This score is from my own attempt and I am reporting it honestly.', confirm: 'Verify and log', onPass: done });
      else done(); }}>
      <div className="fgrid"><label className="f">Exam<select value=${f.exam} onChange=${(e) => setF({ ...f, exam: e.target.value })}>${S.certs.map((c) => html`<option key=${c.id}>${c.name}</option>`)}<option>Other</option></select></label>
        <label className="f">Date<input type="date" value=${f.date} onInput=${(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="f">Score (%)<input type="number" min="0" max="100" inputMode="decimal" value=${f.score} onInput=${(e) => setF({ ...f, score: e.target.value })} /></label></div>
      <label className="f">Weak topics (comma separated)<input type="text" value=${f.weak} placeholder="subnetting, PBQs, risk" onInput=${(e) => setF({ ...f, weak: e.target.value })} /></label>
      <label className="f">Notes<textarea style=${{ minHeight: 64 }} value=${f.notes} onInput=${(e) => setF({ ...f, notes: e.target.value })}></textarea></label>
      <button className="btn primary" type="submit"><${Icon} n="plus" />Log test</button><p className="xs muted">Scores of 80% or more pay ${CONFIG.xp.practiceExam80} XP and open a verification window first.</p></form></${Tile}>
    <div className="col gap-16"><${Tile} title="Weak topics">${topWeak.length ? html`<div className="row wrap">${topWeak.map(([w, n]) => html`<span key=${w} className="chip lilac">${w} · ${n}</span>`)}</div>` : html`<p className="small muted">Weak topics you log will be counted here.</p>`}</${Tile}>
      <${Tile} title="History">${S.practice.length ? html`<table className="t"><thead><tr><th>Date</th><th>Exam</th><th>Score</th><th></th></tr></thead><tbody>${S.practice.slice(0, 20).map((p) => html`<tr key=${p.id}><td>${fmtDate(p.date)}</td><td>${p.exam}<div className="xs muted">${p.weak}</div></td><td className="num">${p.score}%</td><td><button className="btn sm icon ghost" aria-label="Delete entry" onClick=${() => ask('Delete this entry?', `${p.exam}, ${p.score}%`, 'Delete', () => removePractice(p.id))}><${Icon} n="trash" /></button></td></tr>`)}</tbody></table>` : html`<${Empty}>No practice tests logged yet.<//>`}</${Tile}></div>${node}</div>`;
}

/* ============================== REWARDS ============================== */
function RewardsPage() {
  useApp(); const [ask, node] = useConfirm();
  const { coins } = totals();
  const [edit, setEdit] = useState(null), [wk, setWk] = useState(startOfWeek(today(), S.settings.weekStart));
  const chests = chestWeeks().filter((c) => !c.opened);
  return html`<div className="page"><div className="page-head"><div><h1>Rewards</h1><p className="muted">Earn coins by studying. Spend them on rewards you choose.</p></div>
      <div className="row"><span className="chip amber"><${Icon} n="coin" size=${14} /><span className="num">${coins}</span> coins</span><span className="chip"><${Icon} n="shield" size=${14} />${S.derived.shields}/${CONFIG.shield.max}</span></div></div>
    <div className="grid2"><div className="col gap-16">
      <${ProgressTile} />
      ${chests.length > 0 && html`<${Tile} title="Weekly bonus chest">${chests.map((c) => html`<div key=${c.weekKey} className="chest"><${Icon} n="rewards" size=${26} /><div className="grow"><strong>Perfect week ready</strong><div className="small muted">Roadmap week ${c.week}: every study task plus the lab are done.</div></div><button className="btn primary" onClick=${() => openChest(c.weekKey)}>Open chest</button></div>`)}</${Tile}>`}
      <${StakeTile} />
      <${Tile} title="Weekly recap" action=${html`<div className="row"><button className="btn sm icon" aria-label="Previous week" onClick=${() => setWk(addDays(wk, -7))}><${Icon} n="left" /></button><button className="btn sm icon" aria-label="Next week" onClick=${() => setWk(addDays(wk, 7))}><${Icon} n="right" /></button></div>`}>
        <p className="small muted" style=${{ marginBottom: 8 }}>${fmtDate(wk)} – ${fmtDate(addDays(wk, 6))}</p><${RecapBody} rc=${recap(wk)} /></${Tile}>
    </div>
    <div className="col gap-16"><${Tile} title="Reward shop" action=${html`<button className="btn sm" onClick=${() => setEdit({ name: '', cost: 50 })}><${Icon} n="plus" />New reward</button>`}>
        <div className="shop">${S.rewards.map((r) => html`<div key=${r.id} className="reward"><div><strong>${r.name}</strong><div className="num small muted">${r.cost} coins</div></div>
          <div className="bar"><i style=${{ width: Math.min(100, (coins / r.cost) * 100) + '%' }}></i></div>
          <div className="row"><button className="btn primary sm grow" disabled=${coins < r.cost} onClick=${() => requestVerify(rewardSpec(r))}>${coins >= r.cost ? 'Redeem' : (r.cost - coins) + ' to go'}</button>
            <button className="btn sm icon ghost" aria-label=${'Edit ' + r.name} onClick=${() => setEdit(r)}><${Icon} n="edit" /></button><button className="btn sm icon ghost" aria-label=${'Delete ' + r.name} onClick=${() => ask('Delete this reward?', r.name, 'Delete', () => deleteReward(r.id))}><${Icon} n="trash" /></button></div></div>`)}</div>
        ${!S.rewards.length && html`<${Empty}>Add a real-life reward you would enjoy.<//>`}
        ${edit && html`<${RewardForm} r=${edit} done=${() => setEdit(null)} />`}</${Tile}>
      <${Tile} title="Redemption history">${S.redemptions.length ? S.redemptions.slice(0, 15).map((h) => html`<div key=${h.id} className="session"><span>${h.name}</span><span className="num small muted">${fmtDate(h.date)} · −${h.cost}</span></div>`) : html`<${Empty}>Nothing redeemed yet.<//>`}</${Tile}></div></div>
    <${Tile} title=${`Badges (${Object.keys(S.badges).length}/${BADGES.length})`}><div className="badges">${BADGES.map((b) => { const d = badgeDef(b.id), got = S.badges[b.id];
      return html`<div key=${b.id} className=${'badge' + (got ? '' : ' locked')}><div className="ico"><${Icon} n=${got ? 'star' : 'lock'} /></div><strong className="small">${d.name}</strong><span className="xs muted">${got ? 'Unlocked ' + fmtDate(got.date) : d.hint}</span></div>`; })}</div></${Tile}>${node}</div>`;
}
function RewardForm({ r, done }) {
  const [f, setF] = useState(r);
  return html`<form className="row wrap" style=${{ marginTop: 14 }} onSubmit=${(e) => { e.preventDefault(); if (!f.name.trim() || !(Number(f.cost) > 0)) return toast('Give the reward a name and a price above zero.', 'error'); saveReward({ ...f, name: f.name.trim(), cost: Math.round(Number(f.cost)) }); done(); }}>
    <label className="f grow" style=${{ minWidth: 160 }}>Reward<input type="text" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
    <label className="f" style=${{ width: 110 }}>Price (coins)<input type="number" min="1" value=${f.cost} onInput=${(e) => setF({ ...f, cost: e.target.value })} /></label>
    <button className="btn primary" type="submit" style=${{ alignSelf: 'flex-end' }}>Save</button><button className="btn ghost" type="button" style=${{ alignSelf: 'flex-end' }} onClick=${done}>Cancel</button></form>`;
}
function StakeTile() {
  const on = S.settings.stakesEnabled && S.settings.loss !== 'off', t = today(), wk = startOfWeek(t, S.settings.weekStart), st = S.stakes[wk];
  const [amt, setAmt] = useState(30), [goal, setGoal] = useState(5);
  if (!on) return html`<${Tile} title="Accountability stake"><p className="small muted">Optional. Lock coins at the start of a week against a goal. Hit it and you get them back plus ${CONFIG.stakeBonusPct}%. Turn it on in Settings.</p></${Tile}>`;
  const done = tasksDoneIn(wk, addDays(wk, 6));
  return html`<${Tile} title="Accountability stake" action=${st && html`<span className=${'chip ' + (st.status === 'won' ? 'good' : st.status === 'lost' ? '' : 'lilac')}>${st.status}</span>`}>
    ${st ? html`<div className="col"><p>${st.amount} coins locked for <strong>${st.goal} tasks</strong> this week.</p><div className="bar lilac"><i style=${{ width: Math.min(100, (done / st.goal) * 100) + '%' }}></i></div><p className="small muted">${done}/${st.goal} done. ${st.status === 'active' ? `Win ${st.amount + Math.floor(st.amount * CONFIG.stakeBonusPct / 100)} coins when you reach the goal.` : st.status === 'won' ? 'You won it back with a bonus.' : 'Not reached this time. A new week is a new chance.'}</p></div>`
      : html`<form className="row wrap" onSubmit=${(e) => { e.preventDefault(); createStake(wk, amt, goal); }}>
          <label className="f" style=${{ width: 110 }}>Coins to lock<input type="number" min="1" value=${amt} onInput=${(e) => setAmt(e.target.value)} /></label>
          <label className="f" style=${{ width: 110 }}>Tasks this week<input type="number" min="1" max="7" value=${goal} onInput=${(e) => setGoal(e.target.value)} /></label>
          <button className="btn primary" type="submit" style=${{ alignSelf: 'flex-end' }}><${Icon} n="lock" />Lock stake</button></form>`}</${Tile}>`;
}

/* ========================= CERTS & PROJECTS ========================== */
const CERT_STATUS = ['planned', 'booked', 'passed', 'failed'], PROJ_STATUS = [['not-started', 'Not started'], ['in-progress', 'In progress']];
function ProjectTile({ p }) {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), locked = p.status === 'published';
  const submit = async (e) => { e.preventDefault(); if (!code.trim()) return toast('Enter the code you were given.', 'error'); setBusy(true);
    const ok = await unlockProject(p.num, code); setBusy(false);
    if (ok) { setCode(''); toast(`Project ${p.num} verified. ${CONFIG.xp.projectPublished} XP.`, 'good'); } else toast('That code does not match this project.', 'error'); };
  return html`<${Tile} title=${`Project ${p.num} · week ${p.week}`} action=${locked && html`<span className="chip good">Verified</span>`}>
    <div className="col"><div><strong>${p.name}</strong><p className="small muted">${p.deliverable}</p></div>
      <div className="fgrid">${locked ? html`<p className="small">Verified and locked.</p>`
        : html`<label className="f">Status<select value=${p.status} onChange=${(e) => setProject(p.num, { status: e.target.value })}>${PROJ_STATUS.map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)}</select></label>`}
        ${locked ? null : html`<${DraftField} label="GitHub link" type="url" placeholder="https://github.com/..." value=${p.github} onSave=${(v) => setProject(p.num, { github: v })} />`}</div>
      ${p.github && /^https?:\/\//.test(p.github) && html`<a className="small" href=${p.github} target="_blank" rel="noopener noreferrer">Open repository</a>`}
      ${!locked && html`<form className="row wrap" onSubmit=${submit}><label className="f grow">Unlock code<input value=${code} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" spellCheck="false" onInput=${(e) => setCode(e.target.value)} /></label><button className="btn" type="submit" disabled=${busy}>Verify</button></form>`}
      ${!locked && html`<p className="xs muted">Finish the project, send it for review, and enter the code you get if it passes.</p>`}</div></${Tile}>`;
}
function CertsPage() {
  useApp();
  return html`<div className="page"><div className="page-head"><div><h1>Certs & Projects</h1><p className="muted">${S.certs.filter((c) => c.status === 'passed').length}/${S.certs.length} certifications passed · ${S.projects.filter((p) => p.status === 'published').length}/12 projects published</p></div></div>
    <h2>Certifications</h2><div className="grid2 even">${S.certs.map((c) => { const d = certDate(c), left = d ? diffDays(d, today()) : null;
      return html`<${Tile} key=${c.id} title=${c.name} action=${c.status === 'passed' ? html`<span className="chip good">Passed</span>` : left !== null && html`<span className=${'chip ' + (left >= 0 && left <= 14 ? 'amber' : '')}>${left >= 0 ? left + ' days' : Math.abs(left) + ' days ago'}</span>`}>
        <div className="col"><p className="small muted">Roadmap target: day ${c.targetDay}${d ? ' (' + fmtDate(d) + ')' : ' (after you start)'} · ${c.targetLabel}</p>
          <div className="fgrid"><label className="f">Status<select value=${c.status} onChange=${(e) => (e.target.value === 'passed' && c.status !== 'passed' ? requestVerify(certSpec(c)) : setCert(c.id, { status: e.target.value }))}>${CERT_STATUS.map((s) => html`<option key=${s} value=${s}>${s}</option>`)}</select></label>
            <label className="f">Actual exam date<input type="date" value=${c.examDate} onChange=${(e) => setCert(c.id, { examDate: e.target.value })} /></label></div>
          <div className="fgrid"><${DraftField} label="Target date (optional override)" type="date" value=${c.targetDate} onSave=${(v) => setCert(c.id, { targetDate: v })} /><${DraftField} label="Cost paid" value=${c.cost} onSave=${(v) => setCert(c.id, { cost: v })} /><${DraftField} label="Score" value=${c.score} onSave=${(v) => setCert(c.id, { score: v })} /></div>
          <${DraftField} label="Notes" multiline value=${c.notes} onSave=${(v) => setCert(c.id, { notes: v })} /></div></${Tile}>`; })}</div>
    <h2 style=${{ marginTop: 10 }}>Projects</h2><div className="grid2 even">${S.projects.map((p) => html`<${ProjectTile} key=${p.num} p=${p} />`)}</div>
    <${Tile} title="Milestone checklist"><div>${S.milestones.map((m) => html`<label key=${m.id} className="check" style=${{ borderBottom: '1px solid var(--border)' }}><input type="checkbox" checked=${m.done} onChange=${() => toggleMilestone(m.id)} /><span className="grow">${m.milestone}</span><span className="chip">${m.targetDay ? (dateForDay(m.targetDay) ? fmtDate(dateForDay(m.targetDay)) : 'Day ' + m.targetDay) : m.target}</span></label>`)}</div></${Tile}></div>`;
}

/* ============================== SETTINGS ============================= */
let installPrompt = null; addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; commit(); });
function SettingsPage() {
  useApp(); const [ask, node] = useConfirm(); const s = S.settings;
  const [cv, setCv] = useState(String(totals().coins)); const fileRef = useRef(null);
  const set = (patch) => { Object.assign(S.settings, patch); saveSettings(); };
  const iphone = /iPhone|iPad|iPod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return html`<div className="page"><div className="page-head"><div><h1>Settings</h1><p className="muted">Everything is stored on this device only.</p></div></div>
    <div className="grid2 even"><div className="col gap-16">
      <${Tile} title="Appearance"><div className="row between"><span>Theme</span><${Pills} label="Theme" value=${s.theme === 'dark' ? 'Dark' : 'Light'} options=${['Dark', 'Light']} onChange=${(v) => set({ theme: v.toLowerCase() })} /></div></${Tile}>
      <${Tile} title="Reminders"><div className="col">
        <div className="fgrid">${[['study', 'Daily study'], ['lab', 'Lab day'], ['review', 'Review day'], ['checkin', 'Check-in']].map(([k, l]) => html`<label key=${k} className="f">${l}<input type="time" value=${s.times[k]} onChange=${(e) => { S.settings.times = { ...s.times, [k]: e.target.value }; saveSettings(); }} /></label>`)}</div>
        <label className="check"><input type="checkbox" checked=${s.weeklyBackup} onChange=${(e) => set({ weeklyBackup: e.target.checked })} /><span>Weekly backup reminder</span></label>
        <div className="row wrap"><button className="btn" onClick=${askNotifications}><${Icon} n="bell" />${s.notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'Notifications on' : 'Allow notifications'}</button>
          <button className="btn ghost" onClick=${() => { runReminders(); toast('Checked reminders. Anything due appears at the top of Today.'); }}>Check reminders now</button></div>
        <p className="small muted">Exam countdown reminders appear 14, 7, 3 and 1 days before each exam. Background notifications are unreliable on some phones, especially iPhone, because a web app cannot wake itself while closed. The in-app banner on Today always shows what is due the next time you open the app. ${iphone && !standalone ? 'On iPhone, first use Share > Add to Home Screen, then open the app from the home screen to allow notifications.' : ''}</p></div></${Tile}>
      <${Tile} title="Plan"><div className="col"><label className="f">Plan start date<input type="date" value=${s.planStart || today()} onChange=${(e) => ask('Change the plan start date?', 'The whole roadmap moves to the new date. Catch-up shifts and task swaps are cleared. Your logged history stays.', 'Change', () => changePlanStart(e.target.value))} /></label>
        <label className="f">Week starts on<select value=${s.weekStart} onChange=${(e) => set({ weekStart: Number(e.target.value) })}><option value="1">Monday</option><option value="0">Sunday</option></select></label>
        <label className="check"><input type="checkbox" checked=${s.introduceByWeek} onChange=${(e) => set({ introduceByWeek: e.target.checked })} /><span>Unlock flash cards week by week</span></label></div></${Tile}>
    </div><div className="col gap-16">
      <${Tile} title="Reward and loss system"><div className="col">
        <div className="f"><span>Loss system</span><${Pills} label="Loss system" value=${{ full: 'Full', low: 'Low', off: 'Off' }[s.loss]} options=${['Full', 'Low', 'Off']} onChange=${(v) => set({ loss: v.toLowerCase() })} /></div>
        <p className="small muted">${{ full: `A missed day costs ${CONFIG.missedCoinPenalty} coins (never below zero) and resets the streak unless a shield covers it.`, low: `A missed day costs ${Math.round(CONFIG.missedCoinPenalty * CONFIG.lossScale.low)} coins. The streak behaves the same.`, off: 'No coin penalties and missed days never break your streak. Stakes are unavailable.' }[s.loss]} XP is never removed, so your level never drops.</p>
        <label className="check"><input type="checkbox" checked=${s.comeback} onChange=${(e) => set({ comeback: e.target.checked })} /><span>Comeback bonus (x${CONFIG.comebackMultiplier} XP after a missed day)</span></label>
        <label className="check"><input type="checkbox" checked=${s.stakesEnabled} disabled=${s.loss === 'off'} onChange=${(e) => set({ stakesEnabled: e.target.checked })} /><span>Allow accountability stakes (opt-in)</span></label>
        <div className="hr"></div>
        <div className="row wrap"><button className="btn sm" onClick=${() => ask('Reset the streak?', 'Your current streak goes to zero and starts again tomorrow. Your longest streak and XP stay.', 'Reset streak', resetStreak)}>Reset streak</button></div>
        <form className="row wrap" onSubmit=${(e) => { e.preventDefault(); const n = Number(cv); if (n >= 0) requestVerify({ kind: 'coins', title: 'Adjust your coin balance', sub: 'Coins normally come only from verified work.', facts: [['Balance now', String(totals().coins)], ['New balance', String(Math.round(n))]], type: 'ADJUST', attest: 'This corrects a mistake. I am not using it to earn coins.', confirm: 'Set coins', onPass: () => setCoins(n) }); }}>
          <label className="f" style=${{ width: 140 }}>Coin balance<input type="number" min="0" value=${cv} onInput=${(e) => setCv(e.target.value)} /></label><button className="btn sm" type="submit" style=${{ alignSelf: 'flex-end' }}>Set coins</button></form></div></${Tile}>
      <${Tile} title="Backup and restore"><div className="col">
        <p className="small muted">Last backup: ${S.kv.lastBackup ? fmtLong(S.kv.lastBackup) : 'never'}. Storage protection: ${S.kv.persisted ? 'persistent (the browser will not clear it automatically)' : 'not guaranteed. Back up regularly.'}</p>
        <div className="row wrap"><button className="btn primary" onClick=${exportAll}><${Icon} n="download" />Export everything (JSON)</button>
          <button className="btn" onClick=${() => fileRef.current.click()}><${Icon} n="upload" />Import backup</button><button className="btn" onClick=${exportCsv}><${Icon} n="download" />Time log (CSV)</button></div>
        <input ref=${fileRef} type="file" accept="application/json,.json" className="sr" onChange=${async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) { const txt = await f.text(); ask('Restore this backup?', 'This replaces ALL data on this device with the file.', 'Restore', () => importAll(txt)); } }} />
        <p className="small muted">Each device keeps its own data. To move between laptop and phone: export on one, send the file to yourself, then import on the other.</p></div></${Tile}>
      <${Tile} title="Start over"><div className="col">
        <p className="small muted">Started by accident, or want a clean slate? This erases your progress (days, time, XP, coins, badges, quiz history, check-ins) so you can begin again from any date. A verification window asks you to confirm and offers a backup first.</p>
        <button className="btn danger" style=${{ alignSelf: 'flex-start' }} onClick=${() => requestVerify(resetSpec())}><${Icon} n="trash" />Reset everything</button></div></${Tile}>
      <${Tile} title="Install"><div className="col"><p className="small muted">${standalone ? 'You are running the installed app.' : 'Install it for a full-screen app that works offline. On iPhone use Share > Add to Home Screen.'}</p>
        ${installPrompt && html`<button className="btn primary" style=${{ alignSelf: 'flex-start' }} onClick=${async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; commit(); }}>Install app</button>`}
        <p className="xs muted">Keyboard shortcuts: <span className="kbd">S</span> start or stop the timer · <span className="kbd">C</span> mark today complete · <span className="kbd">N</span> new note</p></div></${Tile}>
    </div></div>${node}</div>`;
}
