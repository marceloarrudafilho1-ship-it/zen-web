# zen-web

Web port of the Zen crypto-wallet investigation desktop app. Invite-gated
sign-up, JWT-cookie sessions, Postgres-backed accounts, deployable to Railway
with the `railway` CLI.

## Quick local run

```bash
cd zen-web
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, INVITE_CODE.
npm install
npm run dev      # Vite on :5173, Express on :3001, /api proxied through
```

Open <http://localhost:5173>, click **Sign up**, paste the invite code from
your `.env`, and create the first account.

## Production build (single port)

```bash
npm run build    # → dist/
npm start        # Express serves dist/ AND /api on $PORT (default 3001)
```

## Deploying to Railway

You need: a Railway account, the `railway` CLI, and 30 seconds.

```bash
# from inside zen-web/
railway login
railway init                         # create / link a project
railway add --plugin postgresql      # adds Postgres → injects DATABASE_URL

# Set the two secrets the app needs (DATABASE_URL is automatic):
railway variables --set "JWT_SECRET=$(node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\")"
railway variables --set "INVITE_CODE=share-this-with-trusted-folks"

railway up                           # build + deploy
railway domain                       # generate a public *.up.railway.app URL
```

That's the whole flow. Subsequent deploys: `railway up`.

### What Railway sets for you

| Variable        | Set by              |
|-----------------|---------------------|
| `DATABASE_URL`  | Postgres plugin     |
| `PORT`          | Railway runtime     |
| `NODE_ENV`      | `production`        |

### What you must set

| Variable      | What it does                                                 |
|---------------|--------------------------------------------------------------|
| `JWT_SECRET`  | Signs session cookies. ≥32 chars of randomness.              |
| `INVITE_CODE` | Required to create new accounts. Rotate by changing it.      |

## How auth works

* `POST /api/auth/signup` — needs `{email, password, inviteCode}`. Server checks
  `inviteCode === process.env.INVITE_CODE`, then hashes the password with bcrypt
  and writes a row to `users`.
* `POST /api/auth/login` — `{email, password}`. On success, sets a 14-day
  `zen_session` httpOnly cookie containing a signed JWT.
* `POST /api/auth/logout` — clears the cookie.
* `GET  /api/auth/me` — returns the user or 401.

Sign-up is invite-gated; login is not. To revoke a person's ability to sign up
*new accounts*, rotate `INVITE_CODE`. To revoke an existing account, delete
their row from `users` — they'll be logged out at session expiry (or instantly
if you also clear their cookie via password reset, not yet implemented).

## What does NOT live in Postgres

Per-user app state (analyzed wallets, notes, API keys, theme choice) still
lives in the browser's `localStorage`, same as the desktop app. The DB only
stores accounts. If you later want cross-device sync, that's a separate
schema.

## Project layout

```
zen-web/
├── server/                # Express backend
│   ├── index.js           # boot + static SPA serving
│   ├── auth.js            # /api/auth/* routes
│   └── db.js              # pg pool + migrate()
├── src/                   # React frontend (copy of the desktop src)
│   ├── components/auth/   # LoginPage, AuthGate
│   └── api/auth.js        # client wrapper around /api/auth
├── vite.config.js
├── nixpacks.toml          # Railway build recipe
├── railway.json           # deploy + healthcheck config
└── .env.example
```
