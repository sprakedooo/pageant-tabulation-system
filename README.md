# 👑 Miss Dumalinao 2026 — LAN Pageant Tabulation System

A complete, offline, LAN-based tabulation system for the live pageant event.
**No internet required** — everything runs on one Windows PC on the venue's local network.

| Stack | |
|---|---|
| Backend | Node.js + Express |
| Database | MySQL 8 |
| Frontend | React + TailwindCSS (Vite) |
| Realtime | Socket.IO |
| Auth | JWT + bcrypt, role-based access |

## Features

- Real-time scoring with instant ranking updates (Socket.IO, no page refresh)
- Automatic weighted score computation (criteria → category → overall)
- Generate **Top 5** (from preliminary), **Top 3** (from Top 5 Q&A), and the **Final Ranking**
- **Back-to-Zero final round** — earlier scores stay on record, but the winner is decided only by the Final Q&A
- Judge tablet-optimized scoring screen with sliders, auto-save, submit confirmation, and post-submit lock (admin can unlock)
- Tabulator live monitor (per-judge score matrix) — read-only
- Public projection display (candidate profiles / Top 5 / Top 3 / winner) — **never shows scores**, fullscreen on double-click
- Audit logs (login, logout, submissions, unlocks, generations) with IP addresses
- PDF reports (preliminary, Top 5, Top 3, final, judge sheets, audit logs), CSV and Excel exports
- 15-minute inactivity timeout, duplicate/double-submission prevention, admin confirmation dialogs
- Automatic MySQL backup every 5 minutes, dark mode, offline-detection banner, LAN latency indicator

---

## 1. Requirements (server PC)

1. **Node.js 20 LTS** — https://nodejs.org (install once, offline after that)
2. **MySQL 8 Community Server** — https://dev.mysql.com/downloads/

## 2. Database setup

```powershell
# from the project root
mysql -u root -p < server\schema.sql
```

This creates the `miss_dumalinao_2026` database with all tables, the official
categories/criteria/weights, and the three rounds.

## 3. Server setup

```powershell
cd server
npm install
copy .env.example .env
notepad .env     # set DB_PASSWORD, JWT_SECRET, MYSQLDUMP_PATH
npm run seed     # creates admin / tabulator / display accounts
```

Default seeded accounts (CHANGE THE PASSWORDS BEFORE THE EVENT):

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin2026` |
| Tabulator | `tabulator` | `tab2026` |
| Display | `display` | `display2026` |

Judges are created by the admin in **Judges** management.

## 4. Build the frontend

```powershell
cd client
npm install
npm run build
```

The server automatically serves `client/dist` — no separate web server needed.

## 5. Run the system

```powershell
cd server
npm start
```

The app is now at `http://localhost` (port 80, configurable in `.env`).

### Make it reachable on the LAN

1. Give the server PC a **static IP**, e.g. `192.168.1.100`
   (Settings → Network → Ethernet → IP assignment → Manual).
2. Allow it through Windows Firewall (run PowerShell **as Administrator**):
   ```powershell
   New-NetFirewallRule -DisplayName "Pageant Tabulation" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
   ```
3. Connect all devices (judge tablets, tabulator laptop, projection PC) to the
   same router/switch — **no internet needed**.
4. Devices open: **`http://192.168.1.100`**
   - Judges log in → judge scoring screen
   - Tabulator logs in → monitor
   - Projection PC opens `http://192.168.1.100/display` (no login needed), double-click for fullscreen

### Run automatically on boot (optional)

```powershell
npm install -g pm2
pm2 start server\src\index.js --name pageant
pm2 save
pm2 startup
```

---

## Deploying to the official server PC (via git)

This repo contains everything except secrets, photos, and build artifacts. On the
official server PC:

```powershell
git clone <this-repo> "MISS DUMALINAO 2026"
cd "MISS DUMALINAO 2026\server"
npm install
copy .env.example .env       # then set the real DB password + a new JWT_SECRET
mysql -u root -p < schema.sql
npm run seed
cd ..\client
npm install
npm run build
cd ..\server
npm start
```

## Multi-day event flow (Miss Dumalinao 2026 schedule)

The system keeps all state in MySQL, so it can be stopped and restarted between
event days — nothing is lost. Locked categories stay locked; scores stay submitted.

**Before June 12** — Admin adds the 10 candidates (with photos) and the judges.
Run a rehearsal, then reset with `mysql -u root -p < server\schema.sql` + `npm run seed`.

**June 14 — National Costume Competition (7:00 PM)**
Open **National Costume** in Rounds & Scoring → judges score live → lock it.
Shut the server down afterwards; scores are saved.

**June 15 — Grand Coronation Night (7:00 PM)**
1. Open each remaining preliminary category as it happens on stage
   (Advocacy Speech, Production Number, Swimsuit, Evening Gown) → score → lock.
2. **GENERATE TOP 5** (confirmation required) → projection "Announce Top 5".
3. Open **Top 5 Q&A** → score → lock → **GENERATE TOP 3** (Back to Zero: earlier scores stay on record but don't carry into the final).
4. Open **Final Q&A** → score → **GENERATE FINAL RANKING** → projection "Announce Winner" 👑.
5. Print PDFs from **Reports** for judges' sign-off.

## Scoring formulas

- Judge category score = Σ(criterion score × criterion weight) ÷ 100 — scale 1–100
- Candidate category score = average of submitted judge scores (active judges only)
- Preliminary overall = NatCost×25% + Advocacy×15% + Production×15% + Swimsuit×20% + Gown×25%
- Top 5 Q&A and Final Q&A = weighted average of their criteria
- **Final winner = highest Final Q&A score only** (back to zero)

## Backups

Automatic `mysqldump` snapshot every 5 minutes into `server/backups/` (last 100 kept).
Restore with: `mysql -u root -p miss_dumalinao_2026 < server\backups\backup-<timestamp>.sql`

## Project structure

```
server/
  schema.sql            # full MySQL schema + official criteria seed
  src/index.js          # Express + Socket.IO entry, serves client/dist
  src/compute.js        # weighted scoring & ranking engine
  src/routes/           # auth, candidates, judges, categories, scores,
                        # rankings, display, reports, audit
  src/backup.js         # 5-minute mysqldump scheduler
  src/seed.js           # default accounts
client/
  src/pages/admin/      # dashboard, candidates, judges, rounds, rankings, reports, audit
  src/pages/judge/      # tablet scoring screen
  src/pages/tabulator/  # live score matrix monitor
  src/pages/display/    # public projection screen
```
