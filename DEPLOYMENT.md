# Deployment Guide — Vercel (frontend) + Railway or Render (backend + DB)

This walks through every click needed to get the demo online. Pick **either**
Railway **or** Render for the backend — they do the same job; steps for both
are given since you may find one's free tier or UI easier on the day.

You need: a GitHub account with this project pushed to a repo, and accounts
on Vercel + (Railway or Render). All are free to sign up.

---

## 0. Push the project to GitHub

```bash
cd transport-analytics
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on github.com (public or private, doesn't matter), then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

Backend and frontend live in the same repo (`backend/` and `frontend/`
folders) — both platforms below let you point at a subfolder, so one repo
is fine.

---

## PART A — Backend + Database on Railway

### A1. Create the project
1. Go to [railway.app](https://railway.app) → sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo** → select your repo.
3. Railway will try to auto-detect and build immediately — **stop it** if it starts building from the repo root; you need to point it at `backend/` first (next step).

### A2. Point it at the backend folder
1. Click into the newly created service → **Settings** tab.
2. Under **Source**, set **Root Directory** to `backend`.
3. Under **Build**, leave build command blank (Railway auto-runs `npm install`).
4. Under **Deploy**, set **Start Command** to:
   ```
   npm run migrate && npm start
   ```
   (You'll change this back to just `npm start` after the first successful deploy — see A6.)

### A3. Add PostgreSQL
1. In the same project, click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway provisions it and automatically creates a `DATABASE_URL` variable — but it's on the *database* service, not your backend service yet. Next step connects them.

### A4. Wire the database to your backend service
1. Click into your **backend service** → **Variables** tab.
2. Click **+ New Variable** → **Add Reference** → pick the Postgres service → select `DATABASE_URL`. This links them so it stays in sync automatically.
3. Add the rest of the variables manually (New Variable → paste name/value):
   | Variable | Value |
   |---|---|
   | `JWT_SECRET` | Generate locally with `openssl rand -hex 32` and paste the output |
   | `CORS_ORIGIN` | Leave a placeholder for now, e.g. `http://localhost:5173` — you'll update this in Part C once your Vercel URL exists |
   | `UPLOAD_DIR` | `/data/uploads` |
   | `PORT` | `4000` (Railway also sets its own `PORT`, that's fine — the app reads `process.env.PORT` either way) |

### A5. Add a persistent volume for uploads
Uploaded PDFs need to survive redeploys. Without this, Railway's filesystem resets on each deploy.
1. Backend service → **Settings** → **Volumes** → **+ New Volume**.
2. Mount path: `/data/uploads`
3. Redeploy after adding it (Railway prompts you).

### A6. Deploy and verify
1. Go to the **Deployments** tab → it should auto-deploy after the settings changes. Watch the build log.
2. Once live, click the service to find its public URL (Settings → Networking → **Generate Domain** if one isn't already there). It'll look like `https://your-app.up.railway.app`.
3. Visit `https://your-app.up.railway.app/health` in a browser — you should see `{"status":"ok"}`.
4. **Important:** now go back to Settings → Deploy and change the Start Command from `npm run migrate && npm start` back to just `npm start`, then redeploy. This avoids re-running migrations (which are safe but pointless) on every future deploy.

### A7. Seed your admin login
1. In the backend service, open the **Shell** (or use Railway CLI: `railway run node src/config/seedAdmin.js you@example.com yourpassword`).
2. Via dashboard shell: click the service → the terminal icon → run:
   ```
   node src/config/seedAdmin.js you@example.com yourpassword
   ```
3. You should see `✅ Admin user ready: you@example.com`.

**Railway backend is done.** Keep the public URL handy — you'll need it for Vercel.

---

## PART A (ALTERNATIVE) — Backend + Database on Render

Skip this if you already did Railway above.

### A1. Create the Postgres database
1. Go to [render.com](https://render.com) → sign in with GitHub.
2. **New +** → **PostgreSQL**. Name it, choose the free tier, create it.
3. Once provisioned, open it and copy the **Internal Database URL** (starts with `postgresql://`) — you'll need this for the backend's env vars.

### A2. Create the backend web service
1. **New +** → **Web Service** → connect your GitHub repo.
2. **Root Directory**: `backend`
3. **Runtime**: Node
4. **Build Command**: `npm install`
5. **Start Command**: `npm run migrate && npm start` (change back to `npm start` after the first successful deploy, same reasoning as Railway A6.4)

### A3. Set environment variables
In the web service → **Environment** tab, add:
| Variable | Value |
|---|---|
| `DATABASE_URL` | The Internal Database URL from A1 |
| `JWT_SECRET` | Output of `openssl rand -hex 32` |
| `CORS_ORIGIN` | Placeholder for now, e.g. `http://localhost:5173` |
| `UPLOAD_DIR` | `/data/uploads` |

### A4. Add a persistent disk for uploads
1. Web service → **Disks** → **Add Disk**.
2. Mount path: `/data/uploads`, size: 1GB is plenty to start.
3. Save — Render will redeploy.

### A5. Deploy and verify
1. **Manual Deploy** → **Deploy latest commit** (or it auto-deploys on push).
2. Watch the logs for `🚍 Transport analytics API running on port ...` and confirm no migration errors.
3. Visit `https://your-app.onrender.com/health` → should return `{"status":"ok"}`.
4. Switch the start command back to `npm start` (per A2) and redeploy.

### A6. Seed your admin login
1. Web service → **Shell** tab (top right).
2. Run:
   ```
   node src/config/seedAdmin.js you@example.com yourpassword
   ```

**Render backend is done.** Keep the public URL (`https://your-app.onrender.com`) handy.

> Free-tier note: Render's free web services sleep after inactivity and take
> ~30–60 seconds to wake on the next request. Fine for an internal demo if
> you warn people about the first-request delay; upgrade to a paid instance
> ($7/month) if that's not acceptable for the client demo.

---

## PART B — Frontend on Vercel

### B1. Prepare the frontend folder
If you haven't scaffolded it yet:
```bash
cd frontend
npm create vite@latest . -- --template react
npm install
```
Make sure `src/components/UploadPdf.jsx` (from the starter) is in place and imported into `src/App.jsx`, e.g.:
```jsx
import UploadPdf from './components/UploadPdf';
function App() {
  const token = /* wire up a login form, or hardcode a token temporarily for the demo */;
  return <UploadPdf token={token} />;
}
export default App;
```
Commit and push this to the same GitHub repo.

### B2. Import the project into Vercel
1. Go to [vercel.com](https://vercel.com) → sign in with GitHub.
2. **Add New** → **Project** → select your repo.
3. **Root Directory**: click Edit → set to `frontend`.
4. Framework Preset should auto-detect as **Vite**. Leave build command (`npm run build`) and output directory (`dist`) as default.

### B3. Set the API URL environment variable
1. Still in the import screen (or later under **Settings → Environment Variables**), add:
   | Name | Value |
   |---|---|
   | `VITE_API_URL` | Your Railway or Render backend URL from Part A (e.g. `https://your-app.up.railway.app`) |
2. Deploy.

### B4. Get your live frontend URL
Once deployed, Vercel gives you a URL like `https://your-project.vercel.app`. Open it and confirm the upload form renders.

---

## PART C — Connect the two (fix CORS)

This step is easy to forget and is the #1 cause of "upload just spins forever":

1. Copy your exact Vercel URL, e.g. `https://your-project.vercel.app` (no trailing slash).
2. Go back to your backend service (Railway or Render) → **Variables/Environment**.
3. Update `CORS_ORIGIN` to that exact URL.
4. Redeploy the backend so it picks up the new value.

---

## PART D — End-to-end test before the client sees it

1. Open your Vercel URL.
2. Log in (or use the temporary hardcoded token if you haven't built the login screen yet) — get a token via:
   ```bash
   curl -X POST https://your-backend-url/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"you@example.com","password":"yourpassword"}'
   ```
3. Upload one real Ashoka/Golden PDF → confirm you get the green "parsed automatically" badge.
4. Upload one real Kalpaka PDF → confirm you get the amber "awaiting AI module" badge.
5. Check Railway/Render logs if anything 500s — the error detail is returned in the JSON response too (`detail` field).

---

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| Upload hangs / browser console shows CORS error | `CORS_ORIGIN` on backend doesn't exactly match your Vercel URL (check http vs https, trailing slash) |
| `relation "trip_batches" does not exist` | Migration didn't run — re-run `npm run migrate` once via the platform's shell |
| 401 on every request | Token expired (8h expiry) or `JWT_SECRET` was regenerated after the token was issued — log in again |
| Render backend takes ~30s on first request | Free tier sleep — expected, mention it before the demo or upgrade the instance |
| Uploaded PDF "disappears" after redeploy | Persistent volume/disk (Part A5/A4) wasn't set up before the upload happened |
