# Cookie Keeper – Cookie Editor

A Manifest V3 cookie editor for Chrome and Edge, built around what users ask for in
[Cookie-Editor's reviews](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm/reviews)
and [GitHub issues](https://github.com/Moustachauve/cookie-editor/issues).

No build step. Load it from `chrome://extensions` → Developer mode → **Load unpacked** → this folder.

## What users asked for → what Cookie Keeper does

| Request | Source | Cookie Keeper |
|---|---|---|
| Export/import **all** cookies, not just the current site | review (Apr 2026), #117, #305 | Scope picker (This site / Site + subdomains / All sites); export "Every cookie, all sites" |
| Keep some cookies when using "Delete all" | review (Jul 2026) | Pin (☆) a cookie: it stays at the top and "Delete all" skips it, as do protected cookies |
| Control over subdomain cookies | review (Jul 2026) | "This site" vs "Site + subdomains" scope; Delete all only touches what's listed |
| Cookies missing from the list | #172, #249, #197 | Finds cookies on other paths, partitioned (CHIPS) cookies and cookies from embedded iframes |
| List goes stale | #278 | Updates live via `cookies.onChanged`, without wiping an edit in progress |
| Import fails with "Unknown error" | #71, #85, #100, #103 | Shows a result for each cookie with the reason it failed (SameSite=None without Secure, expiry in the past, `__Host-` rules…) |
| Can't import from a file | review | The file picker opens in a tab (pickers close popups); you can also drag and drop a file |
| Breaks after importing lots of cookies | review (Sep 2026) | Draws the list 200 rows at a time |
| Quick copy of a value | #180 | Copy button on every row; "Copy JSON" per cookie |
| Pin important cookies | #182 | ☆ pin |
| Set a path on new cookies | #200 | Full editor: path, expiry, SameSite, Secure, HttpOnly, host-only, partition |
| Read-only cookies | #12 | **Protect**: a service worker reverts any change or deletion by a site |
| Block cookies | #104 | **Block**: deleted as soon as a site sets it, by name or `*`, subdomains included |
| Incognito | #57 | Store picker when an incognito store exists (`"incognito": "spanning"`) |
| Netscape subdomain flag wrong | #110 | Netscape export writes the flag from `hostOnly` and adds the `#HttpOnly_` prefix |
| Formats from other tools | — | Imports Cookie-Editor/EditThisCookie JSON, Playwright `storageState`, Netscape cookies.txt and `Cookie:` header strings |
| People tricked into handing over cookies | #303 | The export panel warns that cookies are live logins |
| Icons without labels, animations | #4, #79, #141 | Buttons have text or ARIA labels, no animations, follows the system light/dark theme |
| Back up cookies on a schedule | #32 | **Backups**: hourly, daily or weekly snapshots, plus "Back up now"; keep the last N, optionally only some domains; restore or download as JSON |
| Popup closes when you click away | — | **Side panel** that follows the active tab, plus "Open in tab" |
| DevTools tab: some want it, some don't | #90, #91 | "Cookies" panel in DevTools, which can be switched off in Settings (⚙) |

## Layout

- `manifest.json`: permissions `cookies`, `storage`, `unlimitedStorage` (for backups), `webNavigation` (to read iframe URLs), `alarms`, `sidePanel`, plus `<all_urls>`
- `background.js`: enforces Protect and Block rules
- `popup.html|css|js`: the UI; the same page is used as a full tab (`?tabId=…`) and in DevTools (`?mode=devtools`)
- `sidepanel.html`: same as `popup.html` with `data-mode="side"`; keep the two in sync
- `devtools.html|js`: registers the DevTools panel
- `lib/backups.js`: snapshot storage, used by the popup and the scheduled alarm
- `icons/icon.svg`: icon source; the PNGs are rendered from it
- `lib/cookies.js`: `chrome.cookies` wrappers and validation
- `lib/formats.js`: JSON / Netscape / header import and export (no `chrome.*`, so it can be tested on its own)

## Before publishing

- Name check (Oct 2026): no current Chrome Web Store listing named "Cookie Keeper" was found; search the store once more before submitting.
- Privacy policy: [PRIVACY.md](PRIVACY.md). Fill in the contact line, host it at a public URL (for example GitHub Pages) and paste that URL into the store's Privacy tab.
