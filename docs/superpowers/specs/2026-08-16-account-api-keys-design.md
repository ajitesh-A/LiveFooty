# Account System with Per-User API Keys — Design

Date: 2026-08-16
Status: Approved by user (2026-08-16)

## Purpose

Add accounts so each user can supply their own football-data.org API key. When a
logged-in user requests match lineups, the backend calls football-data using that
user's key (their own 10 req/min budget) instead of the shared server key.

## Decisions

- **User store:** JSON file `backend/data/users.json`, read into memory at boot,
  atomic writes (same pattern as `archive.json`).
- **Passwords:** `node:crypto` scrypt (cost + salt + hash stored; no plaintext).
- **Sessions:** HMAC-SHA256 signed token (30-day expiry), secret persisted in
  `backend/data/secret.key` (generated on first boot) so tokens survive restarts.
- **Per-user key scope:** football-data **lineups** calls only. Shared caches
  (official scores / fixtures, archive sync) remain server-keyed.
- **Key validation:** on save, one live test call to football-data
  (`/v4/matches?limit=1` with the key); invalid keys are rejected.
- **Guests:** browse everything exactly as today (server key fallback).
- **Zero new npm dependencies.**

## Out of scope (YAGNI)

Email verification, password reset, per-account rate limiting, multi-tenant
caching, TheSportsDB keys.

## API

| Route | Auth | Body | Result |
|---|---|---|---|
| `POST /api/auth/register` | – | `{email, password}` | 201 `{token, user}` |
| `POST /api/auth/login` | – | `{email, password}` | 200 `{token, user}` |
| `POST /api/auth/logout` | token | – | 204 (stateless drop) |
| `GET /api/auth/me` | token | – | `{user}` |
| `PUT /api/auth/me/fd-key` | token | `{fdKey}` | validates key → `{user, keyStatus}` |
| `DELETE /api/auth/me/fd-key` | token | – | `{user, keyStatus}` |

- Errors: `401` bad login, `409` duplicate email, `422` invalid key/shape.
- `user` = `{id, email, createdAt, hasFdKey}` — the key itself is **never** echoed.
- Token in `Authorization: Bearer <token>` header.

## Data flow

1. User saves key → validation call → stored on `users.json` entry.
2. `GET /api/matches/:id/lineups` → `findMatch` → if authed user has `fdKey`,
   `getLineups(match, { apiKey: userKey })` → `fromFootballdata` uses it
   (falls back to `.env` otherwise), then TheSportsDB fallback as today.
3. Lineups results still cached per match (archive cache unchanged).

## Frontend

- `AuthContext` — token in `localStorage`, `user`, `login/register/logout`,
  restores session on load.
- `pages/Login.jsx` / `pages/Register.jsx` — shared form styling; Auth page
  redirects to home when logged in; protected route for Account.
- `pages/Account.jsx` — email display, football-data key input + save/remove
  with live validation feedback, logout button.
- `Navbar` — "Sign in" button when logged out; "My account" + logout when in.
- `App.jsx` — routes `/login`, `/register`, `/account` (protected).

## Verification

- Register → login → save invalid key (422) → save valid key (200).
- Authed lineups request uses user key (football-data responds, `source:
  football-data`); guest request still works via env key.
- Restart backend → token still valid (secret persisted).
- `npm run build` frontend; manual click-through of account flow.