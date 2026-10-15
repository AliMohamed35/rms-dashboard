# RMS fee dashboard

Green and purple fees by team and collector: month to date (MTD), weekly review (WPR) and team distribution, with uploads for the daily RAW FEES export and the monthly vacation report.

**Stack:** React 19 + Vite, Tailwind CSS v4, D3 for charts, and **json-server** as the database (`db.json`).

## Run locally

```bash
npm install
npm run dev        # json-server API on :3001 + Vite on :5173
```

Open http://localhost:5173. Locally, json-server reads and writes `db.json` directly, so uploads change the file.

If those ports are taken: `API_PORT=3101 npm run dev` (Vite picks the next free port by itself).

| Script | What it does |
| --- | --- |
| `npm run dev` | API and web app together |
| `npm run api` | Only the json-server API (`http://localhost:3001/api`) |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel. The settings come from `vercel.json` (framework Vite, output `dist`), so leave the defaults.
2. **To make uploads work:** in the project open **Storage → Create → Blob**, choose **Private**, and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`. Redeploy.
3. Optional: set `EDITOR_KEY` under **Settings → Environment Variables**. Saving then asks for this key once per browser.

Vercel's filesystem is read-only, so on Vercel the same json-server app keeps `db.json` in that private Blob store. The first deploy starts from the bundled `db.json`. **Without a Blob store the site still works, but read-only:** the Update numbers, Undo, Make a change and Close month buttons stay hidden.

## How data flows

```
browser ──/api──▶ json-server (server/app.js)
                    ├─ local:  db.json on disk            (server/dev.js)
                    └─ Vercel: db.json in Vercel Blob     (api/index.js)
```

- **Reads.** json-server serves every collection read-only, e.g. `GET /api/snapshot_log?date=2026-10-14` or `GET /api/team_history?month=2026-10&team=BEN`. The app itself loads `GET /api/db` once and computes every derived table in the browser (`src/lib/calcs.js`).
- **Writes.** Every change goes through `POST /api/_save` as a small diff (upserts and deletes by key) and is recorded with its inverse. That is what makes **Undo last change** (`POST /api/_undo`) possible. Plain json-server writes (`POST/PUT/PATCH/DELETE /api/<collection>`) are disabled so nothing bypasses the history.

## Editor features

- **Update numbers.** Upload the RAW FEES export (.ods, .xlsx or .csv) and pick the day it covers. It is checked against the last saved day (identical numbers are rejected), summarised, and saved on confirm. The first upload of a new month also starts that month's team list.
- **Days off.** Upload the monthly vacation-period report (.xlsx or .ods). It replaces that month's days off. People are matched to collectors by employee number (`people` in `db.json`).
- **Undo last change.** Click once to see what will be undone, then click again to undo it.
- **Distribution → Make a change.** Move, leave out, mark as left, or add a new hire. A change effective on or before the 15th counts for that month; after the 15th it counts from the next month.
- **Month close → Close month.** Freezes a month's final numbers.

Files are read entirely in the browser; only the resulting rows are sent to the API.

## Project layout

```
api/index.js            Vercel function (json-server, Blob storage)
server/app.js           json-server app: read API, /_save, /_undo, history
server/storage.js       db.json on disk, in Vercel Blob, or read-only
server/dev.js           local API server
db.json                 the data (json-server database)
src/lib/calcs.js        all derived tables (pace, forecast, WPR, 80% check, …)
src/lib/fees.js         RAW FEES parsing and building a day's snapshot
src/lib/vacation.js     vacation report parsing
src/lib/roster.js       team changes and month close
src/lib/spreadsheet.js  .ods / .xlsx / .csv reader (no dependencies)
src/charts/             D3 charts
src/sections/           page sections (mtd, wpr, distribution, update panel)
```
