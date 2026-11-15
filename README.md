# SDE Stock & Cash Reconciliation (PWA demo)

Static, offline-capable site. No backend; data lives in the browser (IndexedDB). PDF built client-side with jsPDF (vendored in `lib/`).

## Run locally
```
cd sde-recon-pwa
npx serve .        # or: python -m http.server 8080
node test.js       # checks the calculations against the paper-form sample
```
Service workers need `http://localhost` or HTTPS.

## Deploy free - Netlify (easiest)
1. Go to https://app.netlify.com/drop (free account).
2. Drag the whole `sde-recon-pwa` folder onto the page.
3. Open the generated `https://xxxx.netlify.app` URL on the phone.

## Deploy free - GitHub Pages
1. Create a new public GitHub repo and push the contents of `sde-recon-pwa` to its `main` branch (files at repo root).
2. Repo -> Settings -> Pages -> Source: "Deploy from a branch" -> `main` / `/ (root)` -> Save.
3. After ~1 minute it is live at `https://<user>.github.io/<repo>/` (all paths are relative, so the sub-folder is fine).

## Install on a phone
- Android (Chrome): menu -> Install app / Add to Home screen.
- iPhone (Safari): Share -> Add to Home Screen.
Open it once online; afterwards it works offline.

## Updating
Change files, then bump `VERSION` in `sw.js` so phones pick up the new cache.

## Printed notes
The form's printed notes live in `config.js` (`FORM_NOTES`) and are printed in the PDF.
