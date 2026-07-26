# Gmail OAuth setup

Steps to create the Google Cloud OAuth client this feature needs. This is a one-time
setup you do in Google's own console — nothing here is code, and none of it can be
automated from this repo.

## 1. Create (or select) a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Top-left project dropdown → **New Project** (or pick an existing one)
3. Give it any name — this project is just a container for the OAuth client and API
   access below, it doesn't need to match your app's name.

## 2. Enable the Gmail API

1. In the left sidebar: **APIs & Services** → **Library**
2. Search for **Gmail API**, open it, click **Enable**

## 3. Configure the OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**
2. User type: **External** (unless every user of your app is inside a Google Workspace
   organization you control — pick **Internal** only in that case)
3. Fill in the required fields (app name, support email, developer contact) — these are
   just what users see on the consent screen, not functionally important for dev/testing
4. **Scopes** step: add
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`

   (these must match `appConfig.gmail.scopes` in `src/config/app-config.ts` — if you
   change the scopes there, update them here too, and vice versa)
5. **Test users** step (while the app is in "Testing" publish status, which is the
   default and fine for development): add the Google account(s) you'll test with —
   Google blocks consent for any account not listed here until the app is verified/published

## 4. Create the OAuth 2.0 Client ID

1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. **Authorized redirect URIs** → add exactly the value you'll put in `GOOGLE_REDIRECT_URI`:
   - Local dev: `http://localhost:3000/api/integrations/gmail/callback`
   - Production: `https://<your-real-domain>/api/integrations/gmail/callback`

   This must match **exactly** (scheme, host, port, path) — Google rejects the callback
   otherwise.
4. Click **Create** — Google shows you a **Client ID** and **Client Secret**. Copy both.

## 5. Fill in `.env`

```
GOOGLE_CLIENT_ID = <the Client ID from step 4>
GOOGLE_CLIENT_SECRET = <the Client Secret from step 4>
GOOGLE_REDIRECT_URI = http://localhost:3000/api/integrations/gmail/callback
TOKEN_ENCRYPTION_KEY = <any long random string — used to encrypt stored tokens at rest>
FRONTEND_URL = http://localhost:5173
```

`TOKEN_ENCRYPTION_KEY` isn't a Google value — generate it yourself, e.g.:
```
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 6. Verify the flow works

1. Start the backend (`npm run dev` in `RAG/`)
2. As a logged-in user, call `GET /api/integrations/gmail/connect` (behind auth) — it
   returns `{ authUrl }`
3. Open that URL in a browser, sign in with one of the **test users** from step 3,
   approve the consent screen
4. Google redirects to `GOOGLE_REDIRECT_URI` with a `code` — the backend exchanges it,
   stores the connection, and redirects the browser to
   `${FRONTEND_URL}/knowledge-base?gmail=connected`
5. `GET /api/integrations/gmail/status` (behind auth, same user) should now report
   `{ connected: true, googleEmail: "..." }`

## Notes / gotchas

- **"Testing" publish status caps test users at 100** and access tokens/consent expire
  faster than a published app — fine for development, but you'll need to move the OAuth
  consent screen to **"In production"** (which requires Google's app verification review
  for sensitive scopes like `gmail.send`) before real, arbitrary users can connect.
- If you ever see "Error 400: redirect_uri_mismatch", it means `GOOGLE_REDIRECT_URI` in
  `.env` doesn't **exactly** match what's registered in step 4 — check for a trailing
  slash, `http` vs `https`, or a different port.
- Changing `appConfig.gmail.scopes` after users have already connected doesn't
  retroactively change their existing grant — they'd need to reconnect (the
  `prompt: "consent"` on `getAuthUrl` forces a fresh consent screen every time, so a
  reconnect always picks up new scopes).
