# LiveFooty — Step-by-Step Hosting Guide

The whole site runs as **one Node.js process** (Express API + built React frontend +
puppeteer) plus a persistent `data/` folder (match archive, lineups, users) and a
`.env` file with API keys. This guide walks you end-to-end: prerequisites → build →
deploy → HTTPS → verify → maintain.

---

## 0. What you need before starting

| Thing | Where to get it | Why |
|---|---|---|
| A server (VPS) | Hetzner CX22 (~€4.6/mo, 4 GB RAM) or Oracle Always Free (see §2) | Runs the Node process |
| A domain (optional) | any registrar | HTTPS + clean URLs (Caddy auto-TLS) |
| Football-data key | https://www.football-data.org (free, 10 req/min) | Official scores/fixtures for all leagues |
| Resend key (optional) | https://resend.com (free: 3000 emails/mo) | Real email verification codes. Without it codes are logged to `backend/data/dev-mail.log` (dev mode) |

> No credit card is required for: Oracle Always Free, Render free tier, Resend free tier.

---

## 1. Build the frontend (do this locally, once)

The backend serves `frontend/dist` automatically when the folder exists — the built
bundle is part of the deploy.

```sh
cd livefooty/frontend
npm ci
npm run build
# → dist/ is created; ship it with the repo (do not gitignore dist/)
```

## 2. Create the environment file

Create `livefooty/backend/.env` (this file is gitignored — never commit it):

```env
FOOTBALL_DATA_API_KEY=your-football-data-key
RESEND_API_KEY=re_xxxxxxxxx          # optional: real emails
MAIL_FROM=LiveFooty <onboarding@resend.dev>
PORT=3001
```

**Local test before deploying:**

```sh
cd livefooty/backend
npm ci
node src/index.js        # visit http://localhost:3001
```

You should see matches, the archive fills from 2026-05-15 → today+14, and
http://localhost:3001/api/archive/status shows `"status": "syncing|ready"`.

---

## 3. Option A — VPS with Docker Compose (recommended)

Best fit: puppeteer needs RAM, the archive needs persistent disk, stream proxying
needs bandwidth. No cold starts, no sleep.

### Step A1 — provision the server

- **Hetzner:** create a CX22 (2 vCPU / 4 GB RAM, ~€4.6/mo). Pick a location close to
  your viewers (e.g. Falkenstein/FSN or Ashburn/ASH).
- **Free alternative — Oracle Always Free:** create an account, go to Compute →
  Instances, choose Ampere A1 (4 OCPU / 24 GB RAM free), pick Mumbai or Frankfurt
  region for low latency. No sleep, no fee.

### Step A2 — install Docker (Debian/Ubuntu)

```sh
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

### Step A3 — copy the repo

```sh
# from your machine:
scp -r livefooty user@SERVER_IP:~/livefooty
# or clone from git (then build the frontend ON the server instead of step 1)
```

If you cloned instead of copying `dist/`:

```sh
cd ~/livefooty/frontend && npm ci && npm run build
```

### Step A4 — start the app

```sh
cd ~/livefooty/backend
docker compose up -d --build
docker compose logs -f    # watch boot: archive sync → lineups backfill
```

Data persists in the `livefooty-data` volume across rebuilds (archive, users,
lineups, session secret).

### Step A5 — HTTPS with Caddy

```sh
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
```

```caddy
livefooty.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

```sh
sudo systemctl reload caddy
```

Point your domain's DNS A record at the server IP first; Caddy auto-issues TLS.

### Step A6 — verify

```sh
curl -s https://livefooty.example.com/api/health     # {"ok":true}
curl -s https://livefooty.example.com/api/archive/status
# register a test account and confirm the verification email arrives
curl -s -X POST https://livefooty.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'
```

---

## 4. Option B — Render.com (PaaS, easiest, no server admin)

`backend/Dockerfile` is Render-compatible. Costs/limits:

| Plan | RAM/CPU | Verdict |
|---|---|---|
| Free | 512 MB / 0.1 CPU | sleeps after 15 min idle, 30–60 s cold starts — bad for live matches |
| Starter $7/mo | 512 MB, never sleeps | workable, RAM is tight under load |
| Standard $25/mo | 2 GB / 1 CPU | comfortable |

Steps:

1. Push the repo to GitHub.
2. Render → **New → Web Service** → connect repo.
3. Root directory: `backend`; Runtime: **Docker**; instance type as above.
4. Add a **Persistent Disk** (mount `/app/data`) — required, the archive must survive
   deploys.
5. Environment variables: copy every line of `backend/.env`.
6. Deploy; Render builds `Dockerfile` (installs Chromium for puppeteer automatically).
7. Attach a domain under Settings; Render handles HTTPS.

---

## 5. Option C — PM2 on any VPS (no Docker)

```sh
sudo apt install -y nodejs npm
cd ~/livefooty/backend && npm ci
cd ../frontend && npm ci && npm run build && cd ../backend
npx puppeteer browsers install chrome
npm i -g pm2
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

`pm2 startup` prints a command — run it so the app survives reboots. Put Caddy in
front for HTTPS (same Caddyfile as §A5).

---

## 6. What NOT to use

- **Cloudflare Pages / Netlify** — can't run the Node backend or proxy streams; you'd
  still need a server for the API.
- **Serverless (Lambda/CF Workers)** — puppeteer and long-lived fetches exceed their
  timeouts.
- **Railway / Fly.io** — workable but pricier than Hetzner for the same RAM.

---

## 7. Post-deploy checklist

- [ ] `/api/health` returns `{"ok":true}` over HTTPS
- [ ] `/api/archive/status` shows a recent `lastSync` and growing `matchCount`
- [ ] Home page loads, league tabs work, a match page shows streams
- [ ] Register an account → verification email arrives → save a football-data key →
      lineups still load (now under the user's quota)
- [ ] Login persists across server restarts (`data/secret.key` survives)

## 8. Ops notes

- **Persistence:** `backend/data/` (archive, users, lineups, `secret.key`) is the only
  state — back it up (volume snapshot, or `scp -r` daily). `secret.key` must survive;
  deleting it logs out every user.
- **Boot behavior:** every launch re-syncs fixtures (2026-05-15 → today+14) then
  backfills lineups for the last 7 days at ~8 req/min in the background.
- **RAM:** puppeteer idle-closes after 5 min; give the container ≥ 1 GB.
- **Bandwidth:** `/api/proxy` relays remote stream/HLS URLs — watch monthly egress as
  traffic grows.
- **Updates:** `git pull && docker compose up -d --build` — the data volume persists.
- **Email in dev mode:** without `RESEND_API_KEY`, codes are written to
  `backend/data/dev-mail.log` and the console; a fresh `dev-mail.log` will be created
  on the server too — delete it in production once real mail is configured.