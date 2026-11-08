# Cyber Study Tracker

Offline-first PWA for the 365-day cybersecurity roadmap. No backend, no login. All data lives in your browser's IndexedDB.
**Start any day:** on first open you press **Start** and Day 1 begins that day (or a date you pick). After that, reminders run every day.

```
index.html        the whole app (CSS, React, your roadmap seed and code are inlined)
manifest.json     PWA manifest (standalone)
sw.js             service worker: cache-first, versioned (CACHE_VERSION)
icons/            192, 512, maskable, apple-touch icons
data/seed.json    roadmap converted to JSON (days, phases, projects, certs, milestones, starter cards)
src/              editable source (core.js = rules, ui_*.js = screens, style.css)
tools/            roadmap_to_seed.py, build.py, make_icons.py, starter_cards.json
```

## 1. Use it every day (no server)

Open the hosted address once on each device and **install** it. After that it opens like a normal app and works fully offline, with the laptop off or on. Nothing to start.

- **Windows / Mac / Linux (Chrome or Edge):** open the site, click the install icon in the address bar (or Settings > Install in the app). It gets its own window and Start menu / Dock icon.
- **Android (Chrome):** menu > Install app / Add to Home screen.
- **iPhone / iPad (Safari):** Share > Add to Home Screen. Open it from the home screen.

## 2. Host it free (done once)

**GitHub Pages:** push this folder to a public repo > Settings > Pages > deploy from branch `main`, folder `/ (root)`. Open `https://<you>.github.io/<repo>/`.
**Netlify:** drag the folder onto https://app.netlify.com/drop.
Everything uses relative paths, so a sub-folder URL works. To ship an update: edit `src/`, run `python tools/build.py`, bump `CACHE_VERSION` in `sw.js`, push. Installed copies update on their next open (you may need to open the app twice).

## 3. Run it locally while developing (optional)

```
python -m http.server 8080
```
then open http://localhost:8080 (a service worker needs `localhost` or https).

## 4. Move data between laptop and phone

Each device keeps its own data. Settings > **Export everything (JSON)** on device A, send the file to yourself (email, cloud drive), then Settings > **Import backup** on device B. Import replaces everything on device B, so export first if B has data you want. Settings also exports the time log as CSV. A weekly backup reminder appears on Today.

## 5. Rules (all numbers live in `CONFIG` at the top of `src/core.js`)

After editing `src/*`, run `python tools/build.py` to rebuild `index.html`, and bump `CACHE_VERSION` in `sw.js` so installed copies update.

**XP**
| Action | XP |
|---|---|
| Complete a daily task | 50 |
| Lab / project day | 150 (needs a timer session or a note) |
| Review day (also "Rest" tasks) | 40 |
| Daily check-in | 20 |
| Focused study | 1 per minute, max 180 per day |
| Quiz card correct | 5 (+5 if you missed it on an earlier day) |
| Practice exam 80%+ | 100 |
| Project published | 300 |
| Certification passed | 1000 |
| Streak bonus | 150 every 7th day, 750 every 30th day |

Custom tasks give no XP. Undoing a completed task removes that task's XP (it was a mistake). Misses never remove XP, so the level never drops.
Levels (cumulative XP): Script Kiddie 0, Packet Sniffer 500, Port Scanner 1500, Shell Popper 3500, Privilege Escalator 7000, Domain Admin 12000, Threat Hunter 20000, Red Team Lead 32000, CISO 50000. These thresholds are defaults I chose.

**Coins:** 1 coin per 10 XP (`coinsPerXp`). Spend them in the Rewards shop. Defaults: Watch an episode 20, Favourite meal 60, Gaming night 100, Buy a book 150.

**Streak:** counts days where the roadmap task is done. **Review days (the roadmap's Sunday reviews) are optional**: done extends the streak, not done never breaks it. Every other day is required. Rest days (up to 2 per month, set ahead of time) are neutral. Skipping a required day breaks the streak like a miss but costs no coins.

**Shields:** earn 1 for every 7-day streak, hold at most 2. A shield automatically covers one missed day: streak kept and no coin penalty (`shieldBlocksPenalty`).

**Missed day:** the streak resets (unless a shield covers it) and you lose 20 coins, never below zero (`missedCoinPenalty`). It is recomputed from your history every time the app opens, so days away are handled. If you later fix a past day, its penalty is refunded.

**Comeback:** the first task after a missed day gives double XP (`comebackMultiplier`).

**Loss system (Settings):** Full = 20 coins. Low = 10 coins. Off = no penalties, and misses never break the streak. You can also reset the streak or set coins manually.

**Weekly chest:** finish every study task plus the lab of one roadmap week (its "Week N"). Open it for 40-100 coins (55%), a shield (30%, coins if you already hold 2), or the Lucky Chest badge (15%).

**Stake (opt-in, Settings):** lock coins at the start of a week against "N tasks this week". Reach it: coins back +50% (paid as soon as you hit the goal). Miss it by week end: the locked coins are gone.

**Behind meter:** counts required past days not finished. It suggests dropping upcoming Sunday reviews as the optional tasks. **Catch-up** shifts the rest of the plan forward by that many days (nothing is deleted; it can be undone). Exam dates in Certs do not move.

**Anti-cheat:** manual time is capped at 3 hours per day; XP from minutes is capped at 180 per day; flash cards only pay XP when they are due.

## Roadmap converter

```
pip install pymupdf
python tools/roadmap_to_seed.py "Cybersecurity_Roadmap_2027.pdf"
python tools/build.py
```
It reads the PDF (or an extracted `.txt`), writes `data/seed.json` and checks 365 days, 8 phases, 12 projects. Day types come from the TYPE RULES in `classify()`. Starter flash cards (146) were written by hand per weekly theme in `tools/starter_cards.json`; they are not from the PDF.

## Notes and limits

- **Reminders:** while the app is open they fire at your set times (Settings). On Android and desktop Chrome/Edge the installed app can also remind you while closed (Periodic Background Sync; the browser decides how often, roughly daily). **iPhone cannot do closed-app reminders in a web app**; the in-app banner shows what is due when you open it. Always allow notifications when asked.
- The roadmap is a sequence of days: Day 1 lands on your start date. Lab and review days follow the roadmap, not the calendar weekday (the PDF puts labs on Saturdays, so start on a Friday to match it exactly).
- Exam dates are computed from your start date. You can override any of them in Certs.
- `?today=YYYY-MM-DD` in the URL pretends it is that date. Use it for testing only.
