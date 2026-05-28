# Vision Theological Seminary — site + admin

A static clone of the VTS website with a small admin panel for non-technical updates.
Hosted on **Vercel** (free tier).

## What the admin can change

Go to `https://your-domain/admin` and sign in with the shared password.

| Section in admin | What it updates on the public site |
| --- | --- |
| **Contact** | Phone/mobile/email on `contact.html` and in every page footer; the `tel:`, `mailto:`, and WhatsApp links in the floating right-hand sidebar; the Google Maps embed |
| **PDFs** | Application form PDF (linked from `Application Form.html`), schedule PDF (linked from `Courses.html` and `Programmes.html`), required-papers PDF (linked from `Courses.html`) |
| **Courses** | The ATA-degrees and non-ATA-degrees card grids on `Courses.html` |
| **Programmes** | The two card grids on `Programmes.html` |
| **Faculty** | Full-time, part-time, visiting, and librarian lists on `Faculty.html` |
| **Fees** | The two fee tables and the schedule footnote on `Fee Structures.html` |
| **Grading** | The evaluation breakdown, the class tiers, and the failure/pass notes on `Grading System.html` |
| **Gallery** | The image cards on `gallery.html` (with image upload, title, year, tag) |

Save publishes immediately — the public pages re-fetch content on the next page load.

## Architecture

```
/                        repo root (Vercel project root)
  api/                   serverless functions (auto-routed at /api/*)
    login.js             POST { password } -> sets session cookie
    logout.js            POST -> clears cookie
    me.js                GET  -> { authed: true|false }
    content.js           GET (public) -> content JSON
                         PUT (auth)   -> save content JSON
    upload.js            POST (auth)  -> issues @vercel/blob upload tokens
  lib/                   shared server code
    auth.js              JWT cookie helpers
    storage.js           reads/writes content blob, falls back to defaults
  data/
    default-content.json initial content (seeds the blob the first time)
  public/                static site (served by Vercel)
    *.html               the pages, with data-cms markers + cms-loader.js
    cms-loader.js        fetches /api/content and replaces marked elements
    css/ js/ img/ lib/ pdf/   original site assets
    admin/               the admin SPA (index.html, admin.css, admin.js)
  vercel.json
  package.json
  .env.example
```

Content storage uses **Vercel Blob**. Text content is a single JSON file
(`cms/content.json`); uploaded PDFs/images are stored under `uploads/`.
PDFs and images upload directly from browser to Blob using a short-lived
token issued by `/api/upload`, so they don't pass through the function and
are not subject to the 4.5 MB body limit.

## Deploy to Vercel

1. **Push this folder to a GitHub repository.**

2. **Create a new project on [vercel.com](https://vercel.com).** Import the
   repo. Framework preset: **Other**. Output directory: leave default
   (Vercel will auto-detect `public/`).

3. **Add a Blob store**: in your project, *Storage* → *Create Database* →
   *Blob*. Vercel will automatically add the `BLOB_READ_WRITE_TOKEN`
   environment variable to all environments.

4. **Set the remaining env vars** (Project Settings → Environment Variables,
   for *Production*, *Preview*, *Development*):

   - `ADMIN_PASSWORD` — the shared admin password.
   - `JWT_SECRET` — a long random string. Generate with
     ```powershell
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```

5. **Redeploy** so the env vars take effect.

6. **Add your custom domain** under *Project Settings → Domains*.

The first time `/api/content` is requested, it serves the defaults from
`data/default-content.json`. The first time the admin clicks **Save** it
writes the JSON blob and from then on the blob is the source of truth.

## Local development

```powershell
npm install
npm install --global vercel
vercel link            # link to the Vercel project
vercel env pull        # downloads env vars into .env.local
vercel dev             # http://localhost:3000
```

`vercel dev` serves the static site **and** the API functions and uses your
real Blob store, so uploads work locally too.

## Notes & limits

- File uploads are capped at 10 MB and restricted to PDF / JPEG / PNG /
  WebP / GIF (see `api/upload.js`).
- The admin session cookie lasts 7 days.
- Content JSON is capped at 1 MB in `api/content.js`.
- Public pages keep their original static markup as a fallback. If the API
  is ever unreachable, the page shows the last-rendered defaults baked into
  the HTML for non-list content; list sections will appear empty until the
  API is back.
- The admin uses a single shared password. To rotate it, change
  `ADMIN_PASSWORD` in Vercel and redeploy — all sessions remain valid until
  they expire (JWT is signed with `JWT_SECRET`; rotate that to force
  logout).
