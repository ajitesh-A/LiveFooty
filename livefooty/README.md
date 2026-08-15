# LiveFooty ⚽

Free live football (soccer) streaming site — embedded streams, minimal lag, maximum quality.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS (dark mode) + HLS.js (low-latency mode)
- **Backend**: Node.js + Express (match schedule API, stream discovery, m3u8 proxy)

## Quick Start

```bash
npm install          # install all workspaces
npm run dev          # starts backend (:3001) + frontend (:5173)
```

Open http://localhost:5173

## Architecture

```
Browser (React + HLS.js)
   │  /api/matches, /api/streams/:id
   ▼
Express backend
   ├── services/officialScores.js → merges score sources by priority (60s cache)
   │     └── sources/footballdata.js → football-data.org (all leagues, needs free key in backend/.env)
   │     └── sources/openligadb.js   → openLigaDB official Bundesliga API (keyless)
   ├── services/liveScores.js → TheSportsDB fallback (free API, keyless)
   ├── services/lineups.js    → confirmed lineups: SofaScore → FotMob → TheSportsDB
   ├── services/schedule.js   → generated last-resort fallback
   ├── scrapers/streams.js    → discovers m3u8 URLs from free source sites
   ├── routes/matches.js      → GET /api/matches?league=..., /:id, /:id/lineups
   └── routes/stream.js       → GET /api/streams/:matchId, GET /api/proxy?url=...
```

## Score & fixture sources (priority order)

1. **football-data.org** — official Opta-backed data for all 6 leagues. Drop a free
   key in `backend/.env` (`FOOTBALL_DATA_API_KEY=...`, see `.env.example`). Free
   tier = 10 req/min; one bulk request covers all leagues per refresh.
2. **openLigaDB** — the official Bundesliga API (keyless). Real kickoff datetimes,
   live goals, final results.
3. **TheSportsDB** — aggregated fallback for leagues the above don't cover.

**Every match shown is real.** No synthetic fixtures or random scores are ever
served. Data is validated: events are dropped when the kickoff time is missing,
the status is stale (scheduled matches whose kickoff passed, live matches older
than 7h, results older than 7 days), or the fixture falls outside the current
window (past week → next 3 weeks, enough to cover season openers). Leagues with
no data (e.g. UCL pre-draw) simply show nothing until fixtures exist.

Live scores refresh every 60s. Fixture dates/times come from the official feeds
and are shown as `Today · 19:00` / `Fri, Aug 21 · 19:00` on cards and match page.

## Lineups

`GET /api/matches/:id/lineups` — tries SofaScore, then FotMob, then TheSportsDB.
SofaScore/FotMob are CDN-protected and may be unreachable from some networks
(403/404) — the TheSportsDB adapter covers played matches using the same event
IDs already returned by the schedule. Lineups are only reported once confirmed
(LIVE / FT, or UPCOMING within 3h of kickoff).

## How streams work

1. `GET /api/streams/:matchId` — backend searches configured source sites for the match
2. Streams are returned as `{ url, label, quality }[]` (m3u8 preferred)
3. Frontend plays the stream via HLS.js with `lowLatencyMode: true`
4. Video is fetched through `/api/proxy` to bypass CORS/anti-hotlink blocking

If no streams are found from external sources, the backend returns placeholder
streams so the UI/player flow can still be tested. Add your own sources in
`backend/src/scrapers/streams.js` (see `SOURCES` array).

## Latency & quality notes

- HLS.js runs in LL-HLS mode (partial segments + blocking reloads) for ~2-5s latency vs 15-30s for iframe embeds
- Adaptive bitrate is enabled by default in HLS.js — quality scales with network
- Direct m3u8 playback avoids the extra latency of iframe-based embedded players

## Scripts

| Command                 | What it does                    |
| ----------------------- | ------------------------------- |
| `npm run dev`           | Backend + frontend in parallel  |
| `npm run dev:frontend`  | Vite dev server only            |
| `npm run dev:backend`   | Express with file watch         |
| `npm run build`         | Production build of frontend    |
| `npm run start`         | Run backend only                |

## Structure

```
livefooty/
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       ├── components/  # Navbar, MatchCard, LeagueFilter, StreamPlayer
│       ├── pages/       # Home, MatchPage
│       ├── hooks/       # useMatches, useStream
│       └── services/    # api.js (API client + leagues)
└── backend/           # Express
    └── src/
        ├── routes/      # matches.js, stream.js
        ├── scrapers/    # streams.js
        └── services/    # schedule.js
```