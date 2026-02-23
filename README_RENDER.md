Render deployment guide for Wilmosolar

This document explains step-by-step how to deploy the Wilmosolar Express app (Node.js + MySQL) to Render.com.

Pre-reqs
- A GitHub repository containing this project.
- A Render account (https://render.com).
- A managed MySQL database (Render may not provide MySQL on your plan). You can use Railway, PlanetScale, ClearDB, DigitalOcean Managed DB, or any accessible MySQL server.

Required environment variables
- DB_HOST
- DB_USER
- DB_PASSWORD
- DB_NAME
- SESSION_SECRET
- NODE_ENV=production
- (optional) TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

Steps to deploy on Render
1. Push your code to GitHub (branch `main` or whichever you choose).
2. Sign in to Render and click New -> Web Service.
3. Connect your GitHub account and select the repository.
4. Configure the service:
   - Branch: `main`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node` (Render will detect)
5. In the "Environment" section (Environment > Environment Variables), add the variables from `.env.example` with the correct values for your DB and session secret.
6. If you use an external MySQL provider, use the connection details they give for `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Make sure the DB allows connections from Render's outbound IPs (or uses a managed provider that is public-facing).
7. Deploy — Render will build and run your service. Monitor logs on the service page.

Common Issues & Troubleshooting
- 500 errors on startup: Check logs for missing env vars or DB connection errors.
- Database connection refused: Ensure your DB is reachable from Render. For hosted DBs that restrict IPs, use a provider that doesn't restrict, or allow Render IP ranges.
- CSRF issues: Make sure `NODE_ENV=production` and cookies/sameSite settings match your deployment (secure cookies require HTTPS).

Optional: Use Render PostgreSQL/Railway MySQL
- If you create your DB inside Railway or Render (if available), copy the provided credentials into Render env vars.

Local testing with .env
- Copy `.env.example` to `.env` and fill values for local testing.
- Run locally:

```bash
npm install
npm start
```

If you'd like, I can:
- Create a small `deploy-checklist.md` with links and exact Render UI screenshots.
- Add a `Dockerfile` to support container-based deploys.
- Help connect a managed MySQL for you (you must share credentials or create the DB and give me access).

---
Created by automation to help deploy the Wilmosolar project.
