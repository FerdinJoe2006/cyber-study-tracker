/* =====================================================================
   STUDY TRACKER - core.js
   Config, IndexedDB layer, date helpers, plan lookup, XP / coins / streak
   engine, spaced repetition, reminders, backup.  No UI code in this file.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. CONFIG  -  every tunable number lives here (see README for meaning)
   --------------------------------------------------------------------- */
const CONFIG = {
  xp: {
    task: 50,              // complete a daily task
    labOrProject: 150,     // finish a Saturday lab or a project day
    review: 40,            // complete a Sunday review (also used for "Rest" days)
    checkin: 20,           // finish the daily check-in
    perMinute: 1,          // study-session bonus: XP per focused minute...
    minuteCapPerDay: 180,  // ...up to this many XP per day
    quizCorrect: 5,        // quiz card answered correctly
    quizWrongBonus: 5,     // extra for a card you got wrong on an EARLIER day
    practiceExam80: 100,   // practice exam score of 80% or more
    projectPublished: 300,
    certPassed: 1000,
    streak7: 150,          // awarded at every 7th streak day
    streak30: 750,         // awarded at every 30th streak day
  },
  coinsPerXp: 0.1,                 // 1 coin per 10 XP (rounded down per award)
  manualMinutesCapPerDay: 180,     // manual time entry cap (anti-cheat)
  missedCoinPenalty: 20,           // coins lost for a missed day (never below zero)
  lossScale: { full: 1, low: 0.5, off: 0 },  // Settings "loss system" level
  shield: { max: 2, every: 7 },    // earn 1 shield per 7-day streak, hold at most 2
  shieldBlocksPenalty: true,       // a shield also cancels the coin penalty
  comebackMultiplier: 2,           // XP multiplier for the first task after a missed day
  restDaysPerMonth: 2,
  stakeBonusPct: 50,               // win a stake: coins back + 50 %
  chest: { coinsMin: 40, coinsMax: 100, odds: { coins: 0.55, shield: 0.30, badge: 0.15 }, fallbackCoins: 60 },
  nightOwl: { from: 23, to: 4 },   // session started at/after 23:00 or before 04:00
  earlyBird: { from: 4, to: 6 },   // session started between 04:00 and 05:59
  quizBadgeTarget: 1000,
  leitnerDays: [0, 1, 2, 4, 8, 16],// index = box (1..5): days until the card is due again
  // planned study hours (used for the "planned pace" line); midpoints of your 2-3 / 5 / 1-2 hour targets
  // keyed by roadmap day type: study days, lab/project days, review days
  plannedHours: { study: 2.5, lab: 5, review: 1.5 },
  targetText: { study: '2-3 h', lab: '5 h', review: '1-2 h' },
  // [name, cumulative XP needed]
  levels: [
    ['Script Kiddie', 0], ['Packet Sniffer', 500], ['Port Scanner', 1500], ['Shell Popper', 3500],
    ['Privilege Escalator', 7000], ['Domain Admin', 12000], ['Threat Hunter', 20000],
    ['Red Team Lead', 32000], ['CISO', 50000],
  ],
  // editable example rewards (you manage the real list in the Rewards tab)
  shopDefaults: [
    { name: 'Watch an episode', cost: 20 }, { name: 'Favourite meal', cost: 60 },
    { name: 'Gaming night', cost: 100 }, { name: 'Buy a book', cost: 150 },
  ],
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  times: { study: '19:00', lab: '10:00', review: '18:00', checkin: '21:30' },
  weekStart: 1,            // 1 = Monday, 0 = Sunday
  planStart: '',           // empty until you press Start; the roadmap then begins on that date
  loss: 'full',           // 'full' | 'low' | 'off'
  stakesEnabled: false,    // stake feature is opt-in
  comeback: true,
  introduceByWeek: true,   // flash cards unlock as their roadmap week arrives
  notifications: false,
  weeklyBackup: true,
};
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Badge catalogue.  `check(ctx)` decides unlock; `hint` is the locked-state text. */
const BADGES = (() => {
  const b = [
    { id: 'first-task', name: 'First Task', hint: 'Complete your first daily task' },
    { id: 'first-lab', name: 'First Lab', hint: 'Complete your first lab or project day' },
    { id: 'streak-7', name: '7-Day Streak', hint: 'Reach a 7-day streak' },
    { id: 'streak-30', name: '30-Day Streak', hint: 'Reach a 30-day streak' },
    { id: 'streak-100', name: '100-Day Streak', hint: 'Reach a 100-day streak' },
  ];
  for (let i = 1; i <= 12; i++) b.push({ id: 'project-' + i, name: 'Project ' + i, hint: 'Publish project ' + i });
  ['isc2cc', 'secplus', 'ejpt', 'sc900', 'cllm', 'pnpt'].forEach((c) => b.push({ id: 'cert-' + c, cert: c, name: '', hint: '' }));
  b.push(
    { id: 'perfect-week', name: 'Perfect Week', hint: 'Finish all 5 weekday tasks plus the Saturday lab in one week' },
    { id: 'night-owl', name: 'Night Owl', hint: 'Start a study session after 11 pm' },
    { id: 'early-bird', name: 'Early Bird', hint: 'Start a study session between 4 am and 6 am' },
    { id: 'quiz-1000', name: '1000 Quiz Cards', hint: 'Answer 1000 quiz cards' },
    { id: 'capstone', name: 'Capstone Complete', hint: 'Publish Project 12, the capstone' },
    { id: 'lucky-chest', name: 'Lucky Chest', hint: 'Win this badge from a weekly bonus chest' },
  );
  return b;
})();

/* ---------------------------------------------------------------------
   2. Small helpers
   --------------------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c, 12); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);   // a - b
const dowOf = (s) => parseYmd(s).getDay();                                     // 0 = Sunday
/* "today": a ?today=YYYY-MM-DD URL parameter overrides it (testing aid only) */
const TODAY_OVERRIDE = (() => { try { const v = new URLSearchParams(location.search).get('today'); return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null; } catch (e) { return null; } })();
const today = () => TODAY_OVERRIDE || ymd(new Date());
const nowMs = () => Date.now();
const startOfWeek = (s, startDow) => addDays(s, -((dowOf(s) - startDow + 7) % 7));
const mondayOf = (s) => startOfWeek(s, 1);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDate = (s) => { const d = parseYmd(s); return `${DOWS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`; };
const fmtLong = (s) => { const d = parseYmd(s); return `${DOWS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${pad(Math.round(m % 60))}m` : `${Math.round(m)}m`);
const fmtClock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------------------------------------------------------------------
   3. IndexedDB layer  (every call is wrapped; failures reach the toast)
   --------------------------------------------------------------------- */
const STORES = {
  kv: { keyPath: 'k' }, days: { keyPath: 'date' }, sessions: { keyPath: 'id' }, ledger: { keyPath: 'key' },
  cards: { keyPath: 'id' }, reviews: { keyPath: 'id' }, quizSessions: { keyPath: 'id' }, checkins: { keyPath: 'date' },
  practice: { keyPath: 'id' }, projects: { keyPath: 'num' }, certs: { keyPath: 'id' }, milestones: { keyPath: 'id' },
  rewards: { keyPath: 'id' }, redemptions: { keyPath: 'id' }, stakes: { keyPath: 'weekKey' }, badges: { keyPath: 'id' },
};
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB is not available in this browser.'));
      const r = indexedDB.open('study-tracker', 1);
      r.onupgradeneeded = () => { for (const [n, o] of Object.entries(STORES)) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, o); };
      r.onsuccess = () => { DB.db = r.result; res(); };
      r.onerror = () => rej(r.error || new Error('Could not open the database.'));
      r.onblocked = () => rej(new Error('Database is blocked by another tab. Close other tabs of this app.'));
    });
  },
  _req(store, mode, fn) {
    return new Promise((res, rej) => {
      try {
        const tx = DB.db.transaction(store, mode);
        const out = fn(tx.objectStore(store));
        tx.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
        tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Transaction aborted'));
      } catch (e) { rej(e); }
    });
  },
  getAll: (s) => DB._req(s, 'readonly', (o) => o.getAll()),
  put: (s, v) => DB._req(s, 'readwrite', (o) => o.put(v)),
  del: (s, k) => DB._req(s, 'readwrite', (o) => o.delete(k)),
  clear: (s) => DB._req(s, 'readwrite', (o) => o.clear()),
  putMany: (s, arr) => DB._req(s, 'readwrite', (o) => { arr.forEach((v) => o.put(v)); }),
};

/* ---------------------------------------------------------------------
   4. App state (in memory, mirrored to IndexedDB)
   --------------------------------------------------------------------- */
const S = {
  settings: { ...DEFAULT_SETTINGS }, kv: {}, plan: [], phases: [], days: {}, sessions: [], ledger: {},
  cards: [], reviews: [], quizSessions: [], checkins: {}, practice: [], projects: [], certs: [], milestones: [],
  rewards: [], redemptions: [], stakes: {}, badges: {}, banners: [], toasts: [], celebrate: null,
  derived: { streak: 0, longest: 0, shields: 0, events: [] }, ready: false, error: null,
};
const listeners = new Set();
let version = 0;
const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
const getVersion = () => version;
const commit = () => { version++; listeners.forEach((f) => f()); };

/* friendly error handling: any failed write shows a toast and keeps the app alive */
function toast(msg, kind = 'info') {
  const t = { id: uid(), msg, kind };
  S.toasts = [...S.toasts, t].slice(-3);
  commit();
  setTimeout(() => { S.toasts = S.toasts.filter((x) => x.id !== t.id); commit(); }, kind === 'error' ? 7000 : 3500);
}
function dbFail(what) { return (e) => { console.error(what, e); toast(`Could not ${what}. Your change may not be saved (${(e && e.message) || 'storage error'}). Try Settings > Backup to export your data.`, 'error'); }; }
const save = (store, val) => DB.put(store, val).catch(dbFail('save to ' + store));
const remove = (store, key) => DB.del(store, key).catch(dbFail('delete from ' + store));
function setKv(k, v) { S.kv[k] = v; save('kv', { k, v }); }

async function loadAll() {
  const [kv, days, sessions, ledger, cards, reviews, qs, checkins, practice, projects, certs, ms, rewards, red, stakes, badges] =
    await Promise.all(['kv', 'days', 'sessions', 'ledger', 'cards', 'reviews', 'quizSessions', 'checkins', 'practice', 'projects', 'certs', 'milestones', 'rewards', 'redemptions', 'stakes', 'badges'].map(DB.getAll));
  S.kv = Object.fromEntries(kv.map((r) => [r.k, r.v]));
  S.settings = { ...DEFAULT_SETTINGS, ...(S.kv.settings || {}), times: { ...DEFAULT_SETTINGS.times, ...((S.kv.settings || {}).times || {}) } };
  S.plan = S.kv.plan || []; S.phases = S.kv.phases || [];
  S.days = Object.fromEntries(days.map((r) => [r.date, r]));
  S.sessions = sessions.sort((a, b) => a.startMs - b.startMs);
  S.ledger = Object.fromEntries(ledger.map((r) => [r.key, r]));
  S.cards = cards; S.reviews = reviews; S.quizSessions = qs.sort((a, b) => a.ts - b.ts);
  S.checkins = Object.fromEntries(checkins.map((r) => [r.date, r]));
  S.practice = practice.sort((a, b) => (a.date < b.date ? 1 : -1));
  S.projects = projects.sort((a, b) => a.num - b.num); S.certs = certs; S.milestones = ms.sort((a, b) => a.id - b.id);
  S.rewards = rewards; S.redemptions = red.sort((a, b) => b.ts - a.ts);
  S.stakes = Object.fromEntries(stakes.map((r) => [r.weekKey, r])); S.badges = Object.fromEntries(badges.map((r) => [r.id, r]));
}

/* First run: copy the seed (roadmap) into the database */
async function seedIfNeeded() {
  if (S.kv.seeded) return;
  const seed = window.SEED;
  const t = today();
  await DB.put('kv', { k: 'plan', v: seed.days }); await DB.put('kv', { k: 'phases', v: seed.phases });
  await DB.putMany('projects', seed.projects); await DB.putMany('certs', seed.certs); await DB.putMany('milestones', seed.milestones);
  await DB.putMany('cards', seed.cards.map((c, i) => ({
    id: 'c' + i, front: c.q, back: c.a, topic: c.topic, week: c.week, box: 1, due: t, reps: 0, lapses: 0, lastWrongDate: null, source: 'starter',
  })));
  await DB.putMany('rewards', CONFIG.shopDefaults.map((r, i) => ({ id: 'r' + i, name: r.name, cost: r.cost })));
  await DB.put('kv', { k: 'settings', v: { ...DEFAULT_SETTINGS } });
  await DB.put('kv', { k: 'firstOpen', v: t }); await DB.put('kv', { k: 'lastLevel', v: 0 });
  await DB.put('kv', { k: 'seeded', v: 1 });
}

/* ---------------------------------------------------------------------
   5. Plan lookup: which roadmap day is shown on which calendar date
   --------------------------------------------------------------------- */
const shiftAt = (date) => (S.kv.shifts || []).reduce((a, s) => (date >= s.from ? a + s.by : a), 0);
/* roadmap day number (1..365) for a date, or 0 when no task is planned */
const isStarted = () => !!S.settings.planStart;
function planNum(date) {
  if (!S.settings.planStart) return 0;
  const ov = S.kv.override || {};
  const n = date in ov ? ov[date] : diffDays(date, S.settings.planStart) + 1 - shiftAt(date);
  return n >= 1 && n <= S.plan.length ? n : 0;
}
const planFor = (date) => { const n = planNum(date); return n ? S.plan[n - 1] : null; };
const isRestDay = (date) => (S.kv.restDays || []).includes(date);
/* required = counts toward streak; optional = a roadmap review day (the old "Sunday review");
   rest = pre-marked rest day; none = no task */
function dayKind(date) {
  const p = planFor(date);
  if (!p) return 'none';
  if (isRestDay(date)) return 'rest';
  if (p.type === 'review') return 'optional';
  return 'required';
}
/* calendar date a roadmap day number lands on (given start date, shifts and swaps); '' if none */
function dateForDay(n) {
  if (!S.settings.planStart || !n) return '';
  const memo = S._dfd && S._dfd.v === version ? S._dfd : (S._dfd = { v: version, m: {} });
  if (n in memo.m) return memo.m[n];
  let out = '';
  for (let i = 0; i < S.plan.length + 400; i++) { const d = addDays(S.settings.planStart, i); if (planNum(d) === n) { out = d; break; } }
  return (memo.m[n] = out);
}
const certDate = (c) => c.examDate || c.targetDate || dateForDay(c.targetDay);
const rec = (date) => S.days[date] || { date };
function statusOf(date) {
  const r = rec(date).status;
  if (r) return r;
  return date < today() && dayKind(date) === 'required' ? 'missed' : 'todo';
}
const isLabLike = (type) => type === 'lab' || type === 'project';
const phaseOf = (num) => S.phases.find((p) => p.num === num);
const planEnd = () => (S.settings.planStart ? addDays(S.settings.planStart, S.plan.length - 1 + (S.kv.shifts || []).reduce((a, s) => a + s.by, 0)) : '');
/* the "current" roadmap week number (0 before the plan starts) */
function currentWeek() {
  if (!S.settings.planStart) return 0;
  const t = today();
  const p = planFor(t) || planFor(addDays(t, -1));
  if (p) return p.week;
  return t < S.settings.planStart ? 0 : 99;
}

/* ---------------------------------------------------------------------
   6. Time tracking
   --------------------------------------------------------------------- */
const minutesOn = (date) => S.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
const manualOn = (date) => S.sessions.filter((s) => s.date === date && s.kind === 'manual').reduce((a, s) => a + s.minutes, 0);
const timerState = () => S.kv.timer || null;
const timerMs = (t = timerState()) => (t ? t.accMs + (t.running ? nowMs() - t.segStart : 0) : 0);

function timerStart() {
  if (timerState()) return;
  const d = new Date();
  setKv('timer', { date: today(), running: true, startedAt: nowMs(), segStart: nowMs(), accMs: 0, startHour: d.getHours() });
  const r = rec(today()); if (planFor(today()) && (!r.status || r.status === 'todo')) setDayStatus(today(), 'doing', true);
  commit();
}
function timerPause() { const t = timerState(); if (!t || !t.running) return; setKv('timer', { ...t, running: false, accMs: t.accMs + nowMs() - t.segStart }); commit(); }
function timerResume() { const t = timerState(); if (!t || t.running) return; setKv('timer', { ...t, running: true, segStart: nowMs() }); commit(); }
function timerStop(discard = false) {
  const t = timerState(); if (!t) return;
  const ms = timerMs(t);
  setKv('timer', null);
  if (discard || ms < 30000) { toast(discard ? 'Timer discarded.' : 'Session under 30 seconds, not logged.'); commit(); return; }
  const minutes = Math.max(1, Math.round(ms / 60000));
  const s = { id: uid(), date: t.date, startMs: t.startedAt, endMs: nowMs(), minutes, kind: 'timer', startHour: t.startHour };
  S.sessions.push(s); save('sessions', s);
  toast(`Logged ${fmtMin(minutes)}.`, 'good');
  refresh([t.date]);
}
function addManual(date, minutes, note) {
  minutes = Math.round(Number(minutes));
  if (!(minutes > 0)) return toast('Enter a number of minutes above zero.', 'error');
  const left = CONFIG.manualMinutesCapPerDay - manualOn(date);
  if (left <= 0) return toast(`Manual time is capped at ${CONFIG.manualMinutesCapPerDay / 60} hours per day. Use the timer for more.`, 'error');
  const add = Math.min(minutes, left);
  const s = { id: uid(), date, startMs: parseYmd(date).getTime(), endMs: parseYmd(date).getTime(), minutes: add, kind: 'manual', note: note || '' };
  S.sessions.push(s); save('sessions', s);
  toast(add < minutes ? `Added ${add} min (daily manual cap reached).` : `Added ${add} min.`, 'good');
  refresh([date]);
}
function deleteSession(id) {
  const s = S.sessions.find((x) => x.id === id); if (!s) return;
  S.sessions = S.sessions.filter((x) => x.id !== id); remove('sessions', id); refresh([s.date]);
}

/* ---------------------------------------------------------------------
   7. Ledger: XP + coins.  Entries have unique keys so awards are idempotent.
   --------------------------------------------------------------------- */
function award(key, o) {
  const ex = S.ledger[key];
  const xp = o.xp || 0;
  const coins = o.coins !== undefined ? o.coins : Math.floor(xp * CONFIG.coinsPerXp);
  if (ex && ex.xp === xp && ex.coins === coins) return false;
  const e = { key, date: o.date || today(), ts: ex ? ex.ts : nowMs(), kind: o.kind, label: o.label, xp, coins, meta: o.meta || {} };
  S.ledger[key] = e; save('ledger', e);
  return !ex;
}
function revoke(key) { if (S.ledger[key]) { delete S.ledger[key]; remove('ledger', key); } }
function totals() { let xp = 0, coins = 0; for (const e of Object.values(S.ledger)) { xp += e.xp || 0; coins += e.coins || 0; } return { xp, coins: Math.max(0, coins) }; }
const balanceAsOf = (date) => Math.max(0, Object.values(S.ledger).reduce((a, e) => (e.date <= date ? a + (e.coins || 0) : a), 0));
function levelInfo(xp = totals().xp) {
  const L = CONFIG.levels; let i = 0;
  while (i + 1 < L.length && xp >= L[i + 1][1]) i++;
  const lo = L[i][1], hi = i + 1 < L.length ? L[i + 1][1] : null;
  return { idx: i, name: L[i][0], lo, hi, next: hi ? L[i + 1][0] : null, pct: hi ? (xp - lo) / (hi - lo) : 1, xp };
}

/* base XP for finishing the task of a day */
function baseXp(type) { return isLabLike(type) ? CONFIG.xp.labOrProject : (type === 'review' || type === 'rest') ? CONFIG.xp.review : CONFIG.xp.task; }
/* anti-cheat: lab and project days need a logged session or a note before they pay XP */
const hasEvidence = (date) => S.sessions.some((s) => s.date === date && s.kind === 'timer') || !!((rec(date).notes || '').trim() || (rec(date).learned || '').trim());
/* comeback: the most recent earlier task day was missed */
function isComeback(date) {
  if (!S.settings.comeback || S.settings.loss === 'off') return false;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(date, -i); const k = dayKind(d);
    if (k === 'none' || k === 'rest') continue;
    if (k === 'optional') continue;
    return statusOf(d) === 'missed';
  }
  return false;
}
/* recompute every award that belongs to one date (safe to call any number of times) */
function syncDate(date) {
  const p = planFor(date), r = rec(date);
  if (p && r.status === 'done') {
    if (!isLabLike(p.type) || hasEvidence(date)) {
      const prev = S.ledger['task:' + date];
      const comeback = prev ? prev.meta.comeback : isComeback(date);
      const base = baseXp(p.type);
      award('task:' + date, { date, kind: 'task', label: `${isLabLike(p.type) ? 'Lab' : p.type === 'review' ? 'Review' : 'Task'} done: Day ${p.day}`, xp: base * (comeback ? CONFIG.comebackMultiplier : 1), meta: { comeback: !!comeback, day: p.day } });
    } else revoke('task:' + date);
  } else revoke('task:' + date);
  const m = Math.min(minutesOn(date), CONFIG.xp.minuteCapPerDay) * CONFIG.xp.perMinute;
  if (m > 0) award('min:' + date, { date, kind: 'minutes', label: `Focused study: ${fmtMin(minutesOn(date))}`, xp: m }); else revoke('min:' + date);
  const c = S.checkins[date];
  if (c && c.finished && c.focus) award('checkin:' + date, { date, kind: 'checkin', label: 'Daily check-in', xp: CONFIG.xp.checkin }); else revoke('checkin:' + date);
  const q = S.reviews.filter((x) => x.date === date).reduce((a, x) => a + (x.xp || 0), 0);
  if (q > 0) award('quiz:' + date, { date, kind: 'quiz', label: `Quiz cards: ${S.reviews.filter((x) => x.date === date).length} answered`, xp: q }); else revoke('quiz:' + date);
}

/* ---------------------------------------------------------------------
   8. Day status changes
   --------------------------------------------------------------------- */
function setDayStatus(date, status, silent) {
  const r = { ...rec(date), date, status };
  S.days[date] = r; save('days', r);
  if (!silent) refresh([date]);
}
function patchDay(date, patch) { const r = { ...rec(date), date, ...patch }; S.days[date] = r; save('days', r); refresh([date]); }
function completeDay(date) {
  const p = planFor(date); if (!p) return;
  const done = rec(date).status === 'done';
  setDayStatus(date, done ? 'todo' : 'done', true);
  if (!done && isLabLike(p.type) && !hasEvidence(date)) toast('Marked done. Lab days pay XP once you log a timer session or add a note.', 'info');
  if (!done) toast(`Day ${p.day} complete.`, 'good');
  refresh([date]);
}
function skipDay(date) { const s = rec(date).status === 'skipped'; setDayStatus(date, s ? 'todo' : 'skipped', true); refresh([date]); }
/* swap the roadmap tasks of two calendar dates */
function rescheduleDay(from, to) {
  if (from === to) return;
  const ov = { ...(S.kv.override || {}) };
  const a = planNum(from), b = planNum(to);
  ov[from] = b; ov[to] = a;
  setKv('override', ov);
  for (const d of [from, to]) if (rec(d).status === 'missed' || rec(d).status === 'skipped') setDayStatus(d, 'todo', true);
  toast(`Swapped the tasks of ${fmtDate(from)} and ${fmtDate(to)}.`, 'good');
  refresh([from, to]);
}
function addCustomTask(date, text) {
  text = (text || '').trim(); if (!text) return;
  const custom = [...(rec(date).custom || []), { id: uid(), text, done: false }];
  patchDay(date, { custom });
}
function toggleCustom(date, id) { patchDay(date, { custom: (rec(date).custom || []).map((c) => (c.id === id ? { ...c, done: !c.done } : c)) }); }
function removeCustom(date, id) { patchDay(date, { custom: (rec(date).custom || []).filter((c) => c.id !== id) }); }

/* rest days: at most 2 per calendar month */
function toggleRestDay(date) {
  const list = S.kv.restDays || [];
  if (list.includes(date)) { setKv('restDays', list.filter((d) => d !== date)); toast('Rest day removed.'); }
  else {
    if (date < today()) return toast('Rest days must be set ahead of time.', 'error');
    const inMonth = list.filter((d) => d.slice(0, 7) === date.slice(0, 7)).length;
    if (inMonth >= CONFIG.restDaysPerMonth) return toast(`Only ${CONFIG.restDaysPerMonth} rest days per month.`, 'error');
    setKv('restDays', [...list, date].sort()); toast(`${fmtDate(date)} is a rest day. Your streak is safe.`, 'good');
  }
  refresh([date]);
}

/* ---------------------------------------------------------------------
   9. Streak / miss / shield replay (derived from history on every open)
   --------------------------------------------------------------------- */
function replay() {
  if (!S.settings.planStart) { S.derived = { streak: 0, longest: S.kv.longestEver || 0, shields: 0, events: [] }; return; }
  const t = today(), start = S.settings.planStart, reset = S.kv.streakReset;
  let from = start; if (reset && addDays(reset, 1) > from) from = addDays(reset, 1);
  const chest = {};
  for (const e of Object.values(S.ledger)) if (e.kind === 'chest' && e.meta && e.meta.shield) chest[e.date] = (chest[e.date] || 0) + 1;
  let streak = 0, longest = 0, shields = 0; const ev = [];
  const n = diffDays(t, from);
  for (let i = 0; i <= n; i++) {
    const d = addDays(from, i);
    if (chest[d]) shields = Math.min(CONFIG.shield.max, shields + chest[d]);
    const kind = dayKind(d); if (kind === 'none' || kind === 'rest') continue;
    const st = statusOf(d);
    if (st === 'done') {
      streak++; longest = Math.max(longest, streak);
      if (streak % CONFIG.shield.every === 0 && shields < CONFIG.shield.max) { shields++; ev.push({ type: 'shield+', date: d }); }
      if (streak % 7 === 0) ev.push({ type: 'streak7', date: d, streak });
      if (streak % 30 === 0) ev.push({ type: 'streak30', date: d, streak });
      continue;
    }
    if (d >= t || kind === 'optional' || S.settings.loss === 'off') continue;
    if (shields > 0) { shields--; ev.push({ type: 'shield-used', date: d }); continue; }
    streak = 0; ev.push({ type: st === 'skipped' ? 'skip' : 'miss', date: d });
  }
  S.derived = { streak, longest: Math.max(longest, S.kv.longestEver || 0), shields, events: ev };
  if (longest > (S.kv.longestEver || 0)) setKv('longestEver', longest);
}
function reconcile() {
  const t = today(), start = S.settings.planStart;
  if (!start) { replay(); return; }
  // 1. any required day in the past that was never finished becomes "missed"
  for (let i = 0; i <= diffDays(addDays(t, -1), start); i++) {
    const d = addDays(start, i);
    if (dayKind(d) !== 'required') continue;
    const st = rec(d).status;
    if (!st || st === 'todo' || st === 'doing') setDayStatus(d, 'missed', true);
  }
  // 2. replay history for streak / shields
  replay();
  // 3. coin penalties and streak bonuses (idempotent ledger entries)
  const scale = CONFIG.lossScale[S.settings.loss] ?? 1;
  const wanted = new Set();
  for (const e of S.derived.events) {
    if (e.type === 'miss' && scale > 0) {
      const key = 'miss:' + e.date; wanted.add(key);
      if (!S.ledger[key]) {
        const pen = Math.min(Math.round(CONFIG.missedCoinPenalty * scale), balanceAsOf(e.date));
        award(key, { date: e.date, kind: 'penalty', label: `Missed day ${fmtDate(e.date)}`, xp: 0, coins: -pen, meta: { pen } });
      }
    }
    if (e.type === 'streak7') award('streak7:' + e.date, { date: e.date, kind: 'streak', label: `${e.streak}-day streak bonus`, xp: CONFIG.xp.streak7 });
    if (e.type === 'streak30') award('streak30:' + e.date, { date: e.date, kind: 'streak', label: `${e.streak}-day streak bonus`, xp: CONFIG.xp.streak30 });
  }
  // a penalty disappears again if its day was later fixed (recoverable, never shaming)
  for (const e of Object.values(S.ledger)) if (e.kind === 'penalty' && !wanted.has(e.key)) revoke(e.key);
}
function resetStreak() { setKv('streakReset', today()); toast('Streak reset. It starts fresh tomorrow.'); refresh([]); }
function setCoins(target) {
  const cur = totals().coins; const diff = Math.round(target) - cur; if (!diff) return;
  award('adjust:' + uid(), { date: today(), kind: 'adjust', label: 'Manual coin adjustment', xp: 0, coins: diff });
  toast(`Coins set to ${Math.round(target)}.`); refresh([]);
}

/* ---------------------------------------------------------------------
   10. Weeks: chest, stake, recap
   --------------------------------------------------------------------- */
const tasksDoneIn = (from, to) => { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (planFor(d) && rec(d).status === 'done') n++; return n; };
/* Perfect week = every non-review task of one ROADMAP week is done (the 5 study days plus the lab).
   Weeks follow the roadmap's own "Week N" grouping, so they work from any start day. */
function roadmapWeeks() {
  const m = {};
  if (!S.settings.planStart) return m;
  const n = diffDays(today(), S.settings.planStart);
  for (let i = 0; i <= n; i++) { const d = addDays(S.settings.planStart, i), p = planFor(d); if (p) (m[p.week] = m[p.week] || []).push(d); }
  return m;
}
function chestWeeks() {
  const out = [];
  for (const [w, dates] of Object.entries(roadmapWeeks())) {
    const full = S.plan.filter((p) => p.week === Number(w) && p.type !== 'review').length;
    const need = dates.filter((d) => planFor(d).type !== 'review');
    if (need.length >= full && need.length >= 3 && need.every((d) => rec(d).status === 'done') && need.some((d) => isLabLike(planFor(d).type)))
      out.push({ weekKey: 'w' + w, week: Number(w), lastDate: dates[dates.length - 1], ...(S.kv.chests || {})['w' + w] });
  }
  return out.sort((a, b) => b.week - a.week);
}
function openChest(weekKey) {
  const chests = { ...(S.kv.chests || {}) };
  if ((chests[weekKey] || {}).opened) return;
  const o = CONFIG.chest.odds, r = Math.random();
  let reward;
  const coins = () => ({ type: 'coins', amount: CONFIG.chest.coinsMin + Math.floor(Math.random() * (CONFIG.chest.coinsMax - CONFIG.chest.coinsMin + 1)) });
  if (r < o.coins) reward = coins();
  else if (r < o.coins + o.shield) reward = S.derived.shields < CONFIG.shield.max ? { type: 'shield' } : { type: 'coins', amount: CONFIG.chest.fallbackCoins };
  else reward = S.badges['lucky-chest'] ? { type: 'coins', amount: CONFIG.chest.fallbackCoins } : { type: 'badge' };
  chests[weekKey] = { opened: true, reward, ts: nowMs() }; setKv('chests', chests);
  if (reward.type === 'coins') award('chest:' + weekKey, { date: today(), kind: 'chest', label: 'Weekly chest', xp: 0, coins: reward.amount });
  else if (reward.type === 'shield') award('chest:' + weekKey, { date: today(), kind: 'chest', label: 'Weekly chest: streak shield', xp: 0, coins: 0, meta: { shield: 1 } });
  else unlockBadge('lucky-chest');
  S.celebrate = { title: 'Bonus chest opened', body: reward.type === 'coins' ? `+${reward.amount} coins` : reward.type === 'shield' ? 'A streak shield' : 'The Lucky Chest badge' };
  refresh([]);
}
/* stakes (opt-in) */
function createStake(weekKey, amount, goal) {
  amount = Math.round(amount); goal = Math.round(goal);
  if (!(amount > 0) || !(goal > 0)) return toast('Enter coins and a task goal above zero.', 'error');
  if (amount > totals().coins) return toast('You do not have that many coins.', 'error');
  if (S.stakes[weekKey]) return toast('This week already has a stake.', 'error');
  const st = { weekKey, amount, goal, status: 'active', ts: nowMs() };
  S.stakes[weekKey] = st; save('stakes', st);
  award('stake:' + weekKey, { date: today(), kind: 'stake', label: `Stake locked: ${goal} tasks`, xp: 0, coins: -amount });
  toast(`Locked ${amount} coins. Hit ${goal} tasks this week to win ${amount + Math.floor(amount * CONFIG.stakeBonusPct / 100)} back.`, 'good');
  refresh([]);
}
function settleStakes() {
  for (const st of Object.values(S.stakes)) {
    if (st.status !== 'active') continue;
    const end = addDays(st.weekKey, 6), done = tasksDoneIn(st.weekKey, end);
    if (done >= st.goal) {
      const back = st.amount + Math.floor(st.amount * CONFIG.stakeBonusPct / 100);
      award('stakewin:' + st.weekKey, { date: today(), kind: 'stake', label: 'Stake won', xp: 0, coins: back });
      st.status = 'won'; save('stakes', st);
      S.celebrate = { title: 'Stake won', body: `+${back} coins back` };
    } else if (today() > end) {
      award('stakelost:' + st.weekKey, { date: end, kind: 'stake-lost', label: 'Stake not reached', xp: 0, coins: 0, meta: { amount: st.amount } });
      st.status = 'lost'; save('stakes', st);
    }
  }
}
/* weekly recap for any week start date */
function recap(weekStart) {
  const end = addDays(weekStart, 6);
  let xp = 0, gained = 0, lost = 0, minutes = 0, tasks = 0, planned = 0, best = null, quizN = 0, ci = 0, missed = 0, focusSum = 0, focusN = 0;
  for (const e of Object.values(S.ledger)) {
    if (e.date < weekStart || e.date > end) continue;
    xp += e.xp || 0;
    if (e.kind === 'penalty') lost += -(e.coins || 0);
    else if (e.kind === 'stake-lost') lost += (e.meta && e.meta.amount) || 0;
    else if (e.coins > 0 && e.kind !== 'adjust') gained += e.coins;
  }
  for (let d = weekStart; d <= end; d = addDays(d, 1)) {
    const m = minutesOn(d); minutes += m; if (!best || m > best.m) best = { d, m };
    if (planFor(d) && dayKind(d) !== 'rest') planned++;
    if (planFor(d) && rec(d).status === 'done') tasks++;
    if (dayKind(d) === 'required' && d < today() && statusOf(d) === 'missed') missed++;
    quizN += S.reviews.filter((r) => r.date === d).length;
    if (S.checkins[d]) { ci++; focusSum += S.checkins[d].focus || 0; focusN++; }
  }
  const perfect = chestWeeks().some((c) => c.lastDate >= weekStart && c.lastDate <= end);
  const win = perfect ? 'A perfect week: every weekday task and the Saturday lab are done.'
    : tasks > 0 ? `You finished ${tasks} task${tasks > 1 ? 's' : ''} and studied ${fmtMin(minutes)}.`
    : minutes > 0 ? `You still put in ${fmtMin(minutes)} of study.` : 'A fresh week is ready when you are.';
  const improve = missed > 0 ? 'Pick one small block early in the week so a busy day does not stack up.'
    : quizN === 0 ? 'Try five flash cards a day to lock in what you studied.'
    : ci === 0 ? 'Try the daily check-in. It takes a minute and helps planning.'
    : 'Keep the same rhythm. Small steady days beat big rare ones.';
  const s = S.derived;
  return { weekStart, end, xp, gained, lost, minutes, tasks, planned, quizN, ci, focus: focusN ? focusSum / focusN : 0, win, improve, streak: s.streak, shields: s.shields, best };
}

/* ---------------------------------------------------------------------
   11. Badges, levels, phases (checked after every change)
   --------------------------------------------------------------------- */
function unlockBadge(id) {
  if (S.badges[id]) return false;
  const b = { id, date: today(), ts: nowMs() }; S.badges[id] = b; save('badges', b);
  const def = badgeDef(id); S.celebrate = S.celebrate || { title: 'Badge unlocked', body: def.name };
  return true;
}
function badgeDef(id) {
  const b = BADGES.find((x) => x.id === id);
  if (b.cert) { const c = S.certs.find((x) => x.id === b.cert); return { ...b, name: (c ? c.name.split(' (')[0].replace('Microsoft ', '').replace('Red Team Leaders ', '').replace('INE ', '').replace('TCM ', '').replace('CompTIA ', '') : b.cert) + ' Passed', hint: 'Pass ' + (c ? c.name : b.cert) }; }
  return b;
}
function checkBadges() {
  const doneDays = Object.values(S.days).filter((r) => r.status === 'done' && planFor(r.date));
  if (doneDays.length) unlockBadge('first-task');
  if (doneDays.some((r) => isLabLike(planFor(r.date).type))) unlockBadge('first-lab');
  const L = S.derived.longest;
  if (L >= 7) unlockBadge('streak-7'); if (L >= 30) unlockBadge('streak-30'); if (L >= 100) unlockBadge('streak-100');
  for (const p of S.projects) if (p.status === 'published') unlockBadge('project-' + p.num);
  for (const c of S.certs) if (c.status === 'passed') unlockBadge('cert-' + c.id);
  if (chestWeeks().length) unlockBadge('perfect-week');
  const hrs = S.sessions.filter((s) => s.kind === 'timer' && s.startHour !== undefined).map((s) => s.startHour);
  if (hrs.some((h) => h >= CONFIG.nightOwl.from || h < CONFIG.nightOwl.to)) unlockBadge('night-owl');
  if (hrs.some((h) => h >= CONFIG.earlyBird.from && h < CONFIG.earlyBird.to)) unlockBadge('early-bird');
  if (S.reviews.length >= CONFIG.quizBadgeTarget) unlockBadge('quiz-1000');
  const p12 = S.projects.find((p) => p.num === 12); if (p12 && p12.status === 'published') unlockBadge('capstone');
}
function checkLevelAndPhases() {
  const lv = levelInfo().idx;
  if (lv > (S.kv.lastLevel || 0)) { S.celebrate = { title: 'Level up', body: `You are now ${levelInfo().name}` }; setKv('lastLevel', lv); }
  /* a phase is "finished" once its last roadmap day is behind us and you finished at least one task in it */
  const cel = [...(S.kv.phasesCelebrated || [])], t = today();
  let changed = false;
  for (const p of S.phases) {
    if (cel.includes(p.num)) continue;
    const lastDay = Math.max(...S.plan.filter((x) => x.phase === p.num).map((x) => x.day));
    const lastDate = dateForDay(lastDay);
    if (!lastDate || t <= lastDate) continue;
    const any = Object.values(S.days).some((r) => r.status === 'done' && (planFor(r.date) || {}).phase === p.num);
    if (any) S.celebrate = S.celebrate || { title: 'Phase finished', body: `Phase ${p.num}: ${p.name}` };
    cel.push(p.num); changed = true;
  }
  if (changed) setKv('phasesCelebrated', cel);
}
/* projects / certs write-through with their XP awards */
function setProject(num, patch) {
  const p = S.projects.find((x) => x.num === num); Object.assign(p, patch); save('projects', p);
  if (p.status === 'published') award('project:' + num, { date: today(), kind: 'project', label: `Project ${num} published`, xp: CONFIG.xp.projectPublished }); else revoke('project:' + num);
  refresh([]);
}
function setCert(id, patch) {
  const c = S.certs.find((x) => x.id === id); const was = c.status; Object.assign(c, patch); save('certs', c);
  if (c.status === 'passed') {
    award('cert:' + id, { date: today(), kind: 'cert', label: `${c.name} passed`, xp: CONFIG.xp.certPassed });
    if (was !== 'passed') S.celebrate = { title: 'Certification passed', body: c.name };
  } else revoke('cert:' + id);
  refresh([]);
}
function toggleMilestone(id) { const m = S.milestones.find((x) => x.id === id); m.done = !m.done; save('milestones', m); commit(); }

/* ---------------------------------------------------------------------
   12. Flash cards (Leitner boxes) and the practice log
   --------------------------------------------------------------------- */
function dueCards() {
  const t = today(), wk = currentWeek();
  return S.cards.filter((c) => c.due <= t && (!S.settings.introduceByWeek || c.week == null || c.week <= wk));
}
function answerCard(card, ok, firstTry) {
  const t = today();
  const c = { ...card };
  let xp = 0;
  if (firstTry) {
    if (ok) {
      xp = CONFIG.xp.quizCorrect + (c.lastWrongDate && c.lastWrongDate < t ? CONFIG.xp.quizWrongBonus : 0);
      c.box = Math.min(5, c.box + 1); c.due = addDays(t, CONFIG.leitnerDays[c.box]); c.reps++;
    } else { c.box = 1; c.due = t; c.lapses++; c.lastWrongDate = t; }
  } else if (ok) { c.due = addDays(t, 1); }                // retry after a miss: back tomorrow, no XP
  const i = S.cards.findIndex((x) => x.id === card.id); S.cards[i] = c; save('cards', c);
  if (firstTry) { const r = { id: uid(), ts: nowMs(), date: t, cardId: c.id, ok, xp }; S.reviews.push(r); save('reviews', r); }
  refresh([t]);
  return c;
}
function finishQuizSession(total, correct) {
  if (!total) return;
  const q = { id: uid(), ts: nowMs(), date: today(), total, correct }; S.quizSessions.push(q); save('quizSessions', q); commit();
}
function addPractice(o) {
  const p = { id: uid(), date: o.date || today(), exam: o.exam, score: Number(o.score), weak: o.weak || '', notes: o.notes || '' };
  S.practice = [p, ...S.practice].sort((a, b) => (a.date < b.date ? 1 : -1)); save('practice', p);
  if (p.score >= 80) award('practice:' + p.id, { date: p.date, kind: 'practice', label: `Practice exam ${p.score}%`, xp: CONFIG.xp.practiceExam80 });
  refresh([]);
}
function removePractice(id) { S.practice = S.practice.filter((p) => p.id !== id); remove('practice', id); revoke('practice:' + id); refresh([]); }
function saveCheckin(date, o) { const c = { date, ...o, ts: nowMs() }; S.checkins[date] = c; save('checkins', c); toast('Check-in saved.', 'good'); refresh([date]); }

/* ---------------------------------------------------------------------
   13. Rewards shop
   --------------------------------------------------------------------- */
function saveReward(r) { if (!r.id) r.id = 'r' + uid(); const i = S.rewards.findIndex((x) => x.id === r.id); if (i >= 0) S.rewards[i] = r; else S.rewards.push(r); save('rewards', r); commit(); }
function deleteReward(id) { S.rewards = S.rewards.filter((r) => r.id !== id); remove('rewards', id); commit(); }
function redeem(id) {
  const r = S.rewards.find((x) => x.id === id); if (!r) return;
  if (totals().coins < r.cost) return toast('Not enough coins yet.', 'error');
  const h = { id: uid(), ts: nowMs(), date: today(), name: r.name, cost: r.cost }; S.redemptions.unshift(h); save('redemptions', h);
  award('spend:' + h.id, { date: today(), kind: 'spend', label: `Redeemed: ${r.name}`, xp: 0, coins: -r.cost });
  S.celebrate = { title: 'Enjoy it', body: r.name }; refresh([]);
}

/* ---------------------------------------------------------------------
   14. Pace, behind-schedule meter, catch-up
   --------------------------------------------------------------------- */
/* roadmap days that should be finished before today but are not (and are not yet caught up) */
function backlog() {
  const out = [], t = today();
  if (!S.settings.planStart) return out;
  for (let d = S.settings.planStart; d < t; d = addDays(d, 1)) {
    const p = planFor(d); if (!p || dayKind(d) === 'rest') continue;
    const st = statusOf(d);
    if ((st === 'missed' || st === 'todo' || st === 'doing') && !rec(d).caught && dayKind(d) === 'required') out.push({ date: d, plan: p });
  }
  return out;
}
/* optional tasks suggested for dropping: Sunday review days (backlog first, then the next two weeks) */
function dropSuggestions() {
  const t = today(), out = [];
  for (let d = addDays(t, -21); d < addDays(t, 14) && out.length < 5; d = addDays(d, 1)) {
    const p = planFor(d); if (p && p.type === 'review' && rec(d).status !== 'done' && !rec(d).caught && d >= S.settings.planStart) out.push({ date: d, plan: p });
  }
  return out;
}
/* shift the rest of the plan forward by the number of unfinished days */
function catchUp(dropReviews) {
  const t = today();
  let list = backlog();
  const reviewDrops = dropReviews ? dropSuggestions().filter((x) => x.date >= t) : [];
  if (!list.length) return toast('Nothing to catch up. You are on pace.', 'good');
  const shifts = [...(S.kv.shifts || []), { from: t, by: list.length }];
  setKv('shifts', shifts);
  for (const b of list) { const r = { ...rec(b.date), date: b.date, caught: true }; S.days[b.date] = r; save('days', r); }
  for (const x of reviewDrops) { const r = { ...rec(x.date), date: x.date, status: 'skipped', caught: true }; S.days[x.date] = r; save('days', r); }
  toast(`Plan shifted forward by ${list.length} day${list.length > 1 ? 's' : ''}. Today now shows the first unfinished task.`, 'good');
  refresh([]);
}
const hoursKey = (type) => (isLabLike(type) ? 'lab' : type === 'review' ? 'review' : 'study');
function plannedHoursOn(date) { const p = planFor(date); return p ? CONFIG.plannedHours[hoursKey(p.type)] : 0; }
/* cumulative arrays for the chart: planned vs actual hours, one point per day from plan start to plan end */
function paceSeries() {
  const start = S.settings.planStart, n = S.plan.length, t = today();
  if (!start) return { planned: [], actual: [], start: '' };
  const planned = [], actual = []; let p = 0, a = 0;
  const byDate = {}; for (const s of S.sessions) byDate[s.date] = (byDate[s.date] || 0) + s.minutes;
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i);
    p += dayKind(d) === 'rest' ? 0 : plannedHoursOn(d); a += (byDate[d] || 0) / 60;
    planned.push(p); actual.push(d <= t ? a : null);
  }
  return { planned, actual, start };
}

/* ---------------------------------------------------------------------
   15. Reminders (Notifications API + in-app banners)
   --------------------------------------------------------------------- */
function reminderCandidates() {
  const t = today(), out = [], T = S.settings.times, p = planFor(t), k = dayKind(t);
  const st = statusOf(t);
  if (p && k !== 'rest') {
    /* lab, review and study days each get their own reminder time */
    if (isLabLike(p.type)) out.push({ id: 'lab:' + t, at: T.lab, title: 'Lab day', body: p.task, tab: 'today' });
    else if (p.type === 'review') out.push({ id: 'review:' + t, at: T.review, title: 'Review day', body: p.task, tab: 'today' });
    else out.push({ id: 'study:' + t, at: T.study, title: 'Time to study', body: p.task, tab: 'today' });
    if (st === 'done') out.length = 0;   // the task reminder only matters while the task is open
    if (!S.checkins[t]) out.push({ id: 'checkin:' + t, at: T.checkin, title: 'Daily check-in', body: 'What did you finish? What blocked you? What is next?', tab: 'quiz' });
  }
  const due = dueCards().length;
  if (due) out.push({ id: 'sr:' + t, at: T.study, title: 'Flash cards due', body: `${due} card${due > 1 ? 's' : ''} ready for review.`, tab: 'quiz' });
  for (const c of S.certs) {
    if (c.status === 'passed') continue;
    const d = certDate(c); if (!d) continue;
    const left = diffDays(d, t);
    if ([14, 7, 3, 1].includes(left)) out.push({ id: `exam:${c.id}:${left}`, at: '09:00', title: `${c.name.split(' (')[0]} in ${left} day${left > 1 ? 's' : ''}`, body: `Exam target ${fmtDate(d)}.`, tab: 'certs' });
  }
  if (S.settings.weeklyBackup) {
    const lb = S.kv.lastBackup, ref = lb || S.kv.firstOpen || t;
    if (diffDays(t, ref) >= 7) out.push({ id: 'backup:' + t, at: T.study, title: 'Weekly backup', body: 'Export your data from Settings so it is safe.', tab: 'settings' });
  }
  return out;
}
function runReminders() {
  const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const log = S.kv.remindLog || [];
  const fired = [];
  for (const r of reminderCandidates()) {
    if (r.at > hm || log.includes(r.id) || S.banners.some((b) => b.id === r.id)) continue;
    S.banners.push(r); fired.push(r);
    if (S.settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((reg) => reg.showNotification(r.title, { body: r.body, icon: 'icons/icon-192.png', tag: r.id })).catch(() => new Notification(r.title, { body: r.body }));
        else new Notification(r.title, { body: r.body });
      } catch (e) { /* in-app banner is the fallback */ }
    }
  }
  if (fired.length) commit();
}
function dismissBanner(id) {
  S.banners = S.banners.filter((b) => b.id !== id);
  setKv('remindLog', [...(S.kv.remindLog || []), id].slice(-120)); commit();
}
async function askNotifications() {
  if (!('Notification' in window)) return toast('This browser does not support notifications. In-app banners still work.', 'error');
  const r = await Notification.requestPermission();
  S.settings.notifications = r === 'granted'; saveSettings();
  toast(r === 'granted' ? 'Notifications allowed.' : 'Notifications not allowed. Banners will still show in the app.', r === 'granted' ? 'good' : 'info');
}

/* ---------------------------------------------------------------------
   16. Settings, backup, restore
   --------------------------------------------------------------------- */
function saveSettings() { setKv('settings', S.settings); applyTheme(); refresh([]); }
function applyTheme() { document.documentElement.setAttribute('data-theme', S.settings.theme); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = S.settings.theme === 'dark' ? '#17141f' : '#f6f3ee'; }
function changePlanStart(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  S.settings.planStart = date; setKv('shifts', []); setKv('override', {});
  saveSettings(); toast('Plan start date updated. Catch-up shifts and swaps were cleared.');
}
/* The Start button: the roadmap begins on `date` (today by default). From then on reminders run every day. */
function startPlan(date) {
  date = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : today();
  S.settings.planStart = date; setKv('shifts', []); setKv('override', {}); setKv('firstOpen', today());
  S.settings.notifications = ('Notification' in window) && Notification.permission === 'granted';
  setKv('settings', S.settings);
  registerBackgroundReminders();
  toast(date > today() ? `Plan starts on ${fmtLong(date)}.` : 'Day 1 begins now. Good luck.', 'good');
  refresh([date]);
  if ('Notification' in window && Notification.permission === 'default') askNotifications();
}
/* Chrome/Edge/Android installed apps may run this while the app is closed (browser decides how often). */
async function registerBackgroundReminders() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) await reg.periodicSync.register('daily-reminder', { minInterval: 6 * 3600 * 1000 });
  } catch (e) { /* not supported or not installed: in-app reminders still work */ }
}

const EXPORT_STORES = Object.keys(STORES);
async function exportAll() {
  const data = {};
  for (const s of EXPORT_STORES) data[s] = await DB.getAll(s);
  const obj = { app: 'cyber-study-tracker', version: 1, exportedAt: new Date().toISOString(), data };
  download(`study-tracker-backup-${today()}.json`, JSON.stringify(obj), 'application/json');
  setKv('lastBackup', today()); toast('Backup downloaded. Keep the file somewhere safe.', 'good'); commit();
}
async function importAll(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return toast('That file is not valid JSON.', 'error'); }
  if (!obj || obj.app !== 'cyber-study-tracker' || !obj.data) return toast('That is not a study tracker backup file.', 'error');
  try {
    for (const s of EXPORT_STORES) { await DB.clear(s); if (Array.isArray(obj.data[s]) && obj.data[s].length) await DB.putMany(s, obj.data[s]); }
    await loadAll(); applyTheme(); refresh([]); toast('Backup restored.', 'good');
  } catch (e) { dbFail('restore the backup')(e); }
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportCsv() {
  const rows = [['date', 'start', 'end', 'minutes', 'type', 'note']];
  for (const s of S.sessions) rows.push([s.date, s.kind === 'timer' ? new Date(s.startMs).toISOString() : '', s.kind === 'timer' ? new Date(s.endMs).toISOString() : '', s.minutes, s.kind, (s.note || '').replace(/"/g, '""')]);
  download(`time-log-${today()}.csv`, rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n'), 'text/csv');
}

/* ---------------------------------------------------------------------
   17. The one function every mutation ends with
   --------------------------------------------------------------------- */
function refresh(dates) {
  const t = today();
  for (const d of new Set([...(dates || []), t])) syncDate(d);
  reconcile();
  for (const d of Object.keys(S.days)) if (d <= t) syncDate(d);   // keeps older days consistent after edits
  settleStakes(); checkBadges(); checkLevelAndPhases();
  commit();
}

/* ---------------------------------------------------------------------
   18. Boot
   --------------------------------------------------------------------- */
async function boot() {
  try {
    await DB.open(); await loadAll(); await seedIfNeeded(); await loadAll();
    applyTheme();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => setKv('persisted', !!ok)).catch(() => {});
    S.ready = true; refresh([]); runReminders();
    if (isStarted()) registerBackgroundReminders();
    setInterval(runReminders, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { reconcile(); runReminders(); commit(); } });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  } catch (e) {
    console.error(e); S.error = (e && e.message) || 'Unknown storage error'; commit();
  }
}
