# Contributing

The extension has no build step: load the repository folder unpacked from `chrome://extensions` and reload it after changes.

## Layout

| Path | What it is |
|---|---|
| `manifest.json` | Manifest V3 config and permissions |
| `background.js` | Service worker: enforces Protect and Block rules, runs scheduled backups |
| `popup.html`, `popup.js`, `popup.css` | The UI. The same page runs as the popup, a full tab (`?tabId=`) and the DevTools panel (`?mode=devtools`) |
| `sidepanel.html` | Copy of `popup.html` with `data-mode="side"`; keep the two in sync |
| `devtools.html`, `devtools.js` | Registers the DevTools panel |
| `lib/cookies.js` | `chrome.cookies` wrappers and validation |
| `lib/formats.js` | JSON, Netscape and header-string import and export; no `chrome.*` calls |
| `lib/backups.js` | Backup storage |
| `icons/icon.svg` | Icon source; the PNGs are rendered from it |

## Website, store images and releases

| Path | What it is |
|---|---|
| `docs/` | GitHub Pages site, served from `main` / `docs` |
| `PRIVACY.md` | The privacy policy. `docs/privacy.html` is generated from it |
| `scripts/build_site.py` | Regenerates `docs/privacy.html` and copies UI previews into `docs/ui/` |
| `store/build.py` | Renders store screenshots, promo tiles, the store icon and `docs/img/social.png` (needs Google Chrome) |
| `store/ui/` | Popup states saved from the running extension with demo cookies; used by the store images and the website |
| `store/listing.md` | Store listing text, permission justifications and privacy answers |
| `scripts/package.sh` | Builds `dist/cookie-keeper-<version>.zip` for upload |

After changing `popup.css` or `PRIVACY.md`, run:

```sh
python3 scripts/build_site.py
python3 store/build.py
```
