# VATO website

Static GitHub Pages website for VATO / Vince Widerman at `https://djvato.com/`.

## Local preview

Requires Node.js 20 or newer. No packages or environment variables are required.

```powershell
npm run dev
```

Open `http://127.0.0.1:4173`.

## Qualification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` validates the production-ready static files and does not deploy or publish anything.

## Hosting

GitHub Pages serves the repository root from the `main` branch. `CNAME` sets the apex domain to `djvato.com`; DNS redirects `www.djvato.com` to the apex domain. Production forms are handled by the existing Formspree endpoints, and the existing GA4 property is retained.

## New media workflow

Place original candidate photos in `media-input/` using the guidance in `media-input/README.md`. Originals are ignored by Git and must remain unchanged. Approved public derivatives belong in `assets/media/` after crop, compression, permission, and vape checks.
