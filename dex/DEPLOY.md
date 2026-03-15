# Deploy to Vercel

## 1. Log in and deploy from CLI

```bash
cd dex
npx vercel login
npx vercel
```

Follow the prompts (link to existing project or create new). To deploy to production:

```bash
npx vercel --prod
```

## 2. Or connect via GitHub

1. Push your repo to GitHub (if not already).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
3. Import your repo.
4. Set **Root Directory** to `dex` (click Edit, set to `dex`).
5. Click **Deploy**.

## 3. Environment variables (optional)

In the Vercel project: **Settings** → **Environment Variables**. Add only what you use:

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Alert emails (portfolio / broadcast) |
| `RESEND_FROM` | Optional sender email (default: alerts@resend.dev) |
| `CRON_SECRET` | Optional; secure `POST /api/alerts/check` (cron) |
| `BROADCAST_SECRET` | Optional; secure emergency broadcast |

Leave blank if you don’t need alerts or broadcast.

## 4. Cron (optional) for alert checks

To run alert checks every 5–15 minutes, add a Cron job in Vercel that calls:

- **URL:** `https://your-app.vercel.app/api/alerts/check`
- **Method:** POST
- **Header:** `Authorization: Bearer YOUR_CRON_SECRET` (if `CRON_SECRET` is set)

You can configure this under **Settings** → **Cron Jobs** (or use an external cron service).

## Note on file storage

Alert rules and ENS profiles are stored under `data/` on the server. On Vercel, the filesystem is ephemeral, so this data may not persist across deployments or serverless invocations. For a persistent hackathon demo, consider moving to a database or Vercel KV/Postgres later.
