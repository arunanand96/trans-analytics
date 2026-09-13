# Transport Analytics — Pass 1 (text-based PDFs, no AI)

This is the working starter for the **first pass** of the project: upload a
bus booking PDF, detect if it has a real text layer, and if so parse it
into structured passenger/trip data — no AI involved. If the PDF has no
text layer (like Kalpaka's vector-drawn PDFs), it's saved and clearly
flagged as **"awaiting AI module"** instead of guessing at bad data.

## Stack

- **Backend**: Node.js + Express
- **PDF parsing**: `pdf-parse` (Node's equivalent of pdfplumber) + per-vendor regex templates
- **Database**: PostgreSQL
- **Auth**: JWT + bcrypt, role-based (admin/analyst/viewer)
- **Frontend**: React + Vite

## 1. Local setup

### Prerequisites
- Node.js 20+ (`node -v` to check)
- PostgreSQL 15+ running locally, or a free instance from Neon/Supabase/Railway

### Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env — set DATABASE_URL, generate JWT_SECRET with: openssl rand -hex 32

npm run migrate          # creates all tables
node src/config/seedAdmin.js you@example.com yourpassword   # creates first admin login

npm run dev              # starts on http://localhost:4000
```

### Frontend

```bash
cd frontend
npm create vite@latest . -- --template react   # if you haven't scaffolded yet
npm install
# copy src/components/UploadPdf.jsx into your src/components/ folder
echo "VITE_API_URL=http://localhost:4000" > .env
npm run dev               # starts on http://localhost:5173
```

Log in via `POST /api/auth/login` with the email/password you seeded to get
a JWT, then pass it into `<UploadPdf token={...} />`. Wire up a real login
form when you're ready — this starter assumes you'll add that screen next.

### Try it

Upload an Ashoka or Golden PDF (text-based) → you should see a green
"parsed automatically" badge with extracted passenger count.
Upload a Kalpaka PDF (image-based) → you should see the amber "awaiting AI
module" badge, and the file will be saved untouched in the database for
later processing.

## 2. Adding a new vendor

Since you don't have per-vendor CSVs and vendor formats vary:

1. Upload one sample PDF from the new vendor.
2. Check the `raw_text` column in `trip_batches` for that upload — that's
   exactly what `pdf-parse` saw.
3. Open `backend/src/parsers/vendorTemplates.js`, copy an existing
   template, and adjust the regexes to match the new vendor's actual
   label wording (e.g. if they write "Reg No" instead of "Vehicle Reg").
4. No other code changes needed. Re-upload and check the confidence score.

If a vendor's PDF has no text layer at all (Kalpaka-style), don't build a
template — it's handled by the image-detection branch and routed to the
Pass-2 AI module (or manual entry, if you decide to launch without Pass 2).

## 3. Online deployment (simplest path — no server admin required)

Since you don't want to manage Nginx/Docker/VPS security yourself, use a
managed platform. This gets you "online" with TLS and backups handled for
you:

| Piece | Suggested service | Why |
|---|---|---|
| Backend (Node/Express) | [Railway](https://railway.app) or [Render](https://render.com) | Push code, they build + run it, HTTPS included automatically |
| Database (Postgres) | Railway/Render's managed Postgres, or [Neon](https://neon.tech) | Automated backups, no server to patch |
| Frontend (React build) | [Vercel](https://vercel.com) or [Netlify](https://netlify.com) | Free tier, HTTPS included, connects to your GitHub repo |

### Steps (Railway example — Render is nearly identical)

1. Push this project to a GitHub repo (backend and frontend can be separate repos or a monorepo).
2. On Railway: **New Project → Deploy from GitHub repo** → pick the backend folder.
3. Add a **PostgreSQL** plugin in the same Railway project — it gives you a `DATABASE_URL` automatically.
4. In the backend service's **Variables** tab, set: `JWT_SECRET`, `CORS_ORIGIN` (your frontend's URL), `UPLOAD_DIR=/data/uploads` (Railway supports persistent volumes — mount one for this path).
5. Under **Settings → Deploy**, set the run command to `npm run migrate && npm start` for the first deploy (so the schema gets applied), then switch it back to `npm start` afterward.
6. Run the admin-seed command once via Railway's shell/console: `node src/config/seedAdmin.js you@example.com yourpassword`.
7. On Vercel: **New Project** → import the frontend repo → set env var `VITE_API_URL` to your Railway backend's public URL → deploy.
8. Point your domain (if you have one) at the Vercel frontend via its custom-domain settings; the backend can stay on its Railway-provided URL, or get its own subdomain too.

**This gets you online with valid HTTPS, automated DB backups, and zero
server patching — no VPS, no Nginx, no Let's Encrypt renewal to babysit.**
It costs a small monthly fee once you're past free tiers (roughly
$5–20/month total for small volume), which is normal and far simpler to
maintain solo than a self-managed VPS.

### If you'd rather self-host on a VPS later
That's still an option once volume/cost justifies it — Dockerize the
backend, put Postgres in a container too, front it with Nginx + Certbot.
Worth revisiting only if managed hosting costs become a real concern; not
needed to launch.

## 4. What's NOT built yet (by design — Pass 2)

- AI vision extraction for image/vector-based PDFs (Kalpaka-style)
- Review queue UI (the API endpoints exist — `GET /api/batches?review_status=pending` — but there's no screen yet)
- Full analytics dashboard / charts
- Password reset, user management screens

The database schema and `extraction_method` / `review_status` /
`source_reliability` fields are already in place so Pass 2 slots in as new
routes, not a redesign.
