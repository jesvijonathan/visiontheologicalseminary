# Vision Theological Seminary — site + admin

Static clone of the **Vision Theological Seminary** site with a small
password-protected admin panel so non-technical staff can update content
(text, PDFs, photos, courses, faculty, fees, gallery) without touching
code.

## Links

| | URL |
| --- | --- |
| Live site | <https://visiontheologicalseminary.vercel.app/> |
| Admin | <https://visiontheologicalseminary.vercel.app/admin/> |
| Source | <https://github.com/jesvijonathan/visiontheologicalseminary> |
| Original | <https://visiontheologicalseminary.in/> |

## Stack

- Static HTML/CSS/JS served from `public/`
- Vercel serverless functions in `api/` (login, content, upload)
- Vercel Blob for storage (JSON content + uploaded files)
- Single shared password, 7-day JWT cookie session
- Auto-deploys on push to `main`. Free tier hosting.

## Deploy

1. Push to GitHub, import the repo into Vercel.
2. Storage → Create Database → **Blob** (Public) → connect to project.
3. Env vars: `ADMIN_PASSWORD`, `JWT_SECRET` (`BLOB_READ_WRITE_TOKEN` is
   added automatically).
4. Redeploy. Sign in at `/admin/`.

Generate a `JWT_SECRET`:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Local dev

```powershell
npm install
vercel link
vercel env pull
vercel dev
```

## Limits

- Uploads: 10 MB, PDF/JPEG/PNG/WebP/GIF.
- Content JSON: 1 MB.
- Session: 7 days. Rotate `JWT_SECRET` to force re-login.
