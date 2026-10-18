# AutoZoom — browser screen recorder with automatic zoom

Static site, no backend, no build step. See [SPEC.md](SPEC.md) for behaviour.

## Run locally
ES modules need http (not file://):
```
cd autozoom && python3 -m http.server 8000   # or: npx serve .
# open http://localhost:8000 in Chrome / Edge
```
`getDisplayMedia` works on `localhost` and any https origin (GitHub Pages is fine).

## Deploy (GitHub Pages)
Push this folder to a repo → Settings → Pages → deploy from branch (root). `.nojekyll` is included.

## Configure
- `js/config.js` — `CHECKOUT_URL` (Creem checkout link), price, watermark text.
- `js/license.js` — `verifyLicense(key)` is a **stub** (accepts `AZPRO-XXXX…` keys for testing).
  TODO: call Creem `/v1/licenses/activate` + `/v1/licenses/validate` through a small serverless proxy
  (the Creem API needs a secret `x-api-key`; never ship it in the static site).

## Files
```
index.html            landing + editor + pricing + license dialog
css/style.css
js/app.js             UI glue, preview loop, recording/export wiring
js/recorder.js        getDisplayMedia + optional mic → MediaRecorder, live motion sampling
js/motion.js          frame-diff activity analysis + auto-zoom segment heuristic
js/camera.js          spring-smoothed camera track, viewport math
js/render.js          compositor (background, padding, shadow, rounded corners, zoom crop, watermark)
js/timeline.js        timeline UI (seek, add/drag/resize/delete segments, activity sparkline)
js/exporter.js        real-time export: WebM (MediaRecorder) / MP4 (WebCodecs H.264 + Opus, mp4-muxer)
js/license.js         license stub + localStorage
js/i18n.js            EN / 中文 strings
js/vendor/mp4-muxer.mjs  mp4-muxer 5.2.1 (MIT, © Vanilagy) — vendored; CDN fallback in config.js
test/                 Playwright smoke tests (test/run.sh)
```

## Tests
`test/run.sh` — syntax check, then headless Chromium: page loads with no console errors, synthetic video →
auto-zoom → WebM 720p + MP4 1080p export (verified with ffprobe), timeline drag/add/delete, preview focus click,
Pro gating, language toggle, and the real `getDisplayMedia`+mic recording path (tab self-capture via Chromium flags).
