/* Service worker: cache-first, versioned cache.
   To ship an update, change CACHE_VERSION. Old caches are deleted on activate. */
const CACHE_VERSION = 'v4';
const CACHE = 'cyber-study-' + CACHE_VERSION;
const ASSETS = ['./', './index.html', './manifest.json', './data/seed.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('cyber-study-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
/* ---- closed-app reminders (Chrome / Edge / Android installed app, via Periodic Background Sync) ----
   The browser decides how often this runs (roughly once a day or less). It reads the app's own
   IndexedDB, finds today's roadmap task, and shows a notification if the task is still open. */
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('study-tracker'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = (db, store, key) => new Promise((res) => { try { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); } });
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayDiff = (a, b) => { const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(a) - p(b)) / 864e5); };
async function remind() {
  const db = await idb();
  const kv = async (k) => ((await idbGet(db, 'kv', k)) || {}).v;
  const settings = await kv('settings'), plan = await kv('plan');
  if (!settings || !settings.planStart || !settings.notifications || !plan) return;
  const now = new Date(), today = ymdLocal(now), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (hm < (settings.times || {}).study) return;                    // wait until your daily study time
  if ((await kv('swNotified')) === today) return;                    // already reminded today
  const shifts = (await kv('shifts')) || [], ov = (await kv('override')) || {};
  const n = today in ov ? ov[today] : dayDiff(today, settings.planStart) + 1 - shifts.reduce((a, s) => (today >= s.from ? a + s.by : a), 0);
  const p = n >= 1 && n <= plan.length ? plan[n - 1] : null;
  if (!p) return;
  const day = await idbGet(db, 'days', today);
  if (day && (day.status === 'done' || day.status === 'skipped')) return;
  if (((await kv('restDays')) || []).includes(today)) return;
  await self.registration.showNotification(p.type === 'review' ? 'Review day' : p.type === 'lab' || p.type === 'project' ? 'Lab day' : 'Time to study', { body: p.task, icon: 'icons/icon-192.png', tag: 'daily-' + today });
  await new Promise((res) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ k: 'swNotified', v: today }); tx.oncomplete = res; tx.onerror = res; });
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'daily-reminder') e.waitUntil(remind().catch(() => {})); });

/* tapping a notification focuses (or opens) the app */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
