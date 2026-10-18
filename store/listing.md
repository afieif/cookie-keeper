# Chrome Web Store listing

Copy these into the developer dashboard. Images are in this folder; rebuild them with `python3 store/build.py`.

## Store listing tab

**Name:** Cookie Keeper – Cookie Editor

**Summary** (132 characters max):

> View, edit, pin, protect, block, import, export and back up cookies, for one site or every site. Nothing leaves your browser.

**Category:** Developer Tools

**Language:** English

**Description:**

```
Cookie Keeper is a cookie editor built from what users kept asking for.

SEE EVERY COOKIE
• This site, this site plus its subdomains, or every cookie in the browser
• Finds cookies set on other paths, partitioned (CHIPS) cookies, and cookies from sites embedded in the page
• The list updates as sites change their cookies

EDIT EVERYTHING
• Name, value, domain, path, expiry, SameSite, Secure, HttpOnly and partition
• Copy any value with one click, or copy a whole cookie as JSON
• Search by name, value or domain

KEEP WHAT MATTERS
• Pin cookies to keep them at the top, and "Delete all" leaves them alone
• Protect a cookie and any change or deletion by a site is undone straight away
• Block a cookie and it's deleted the moment a site sets it

IMPORT AND EXPORT
• JSON, Netscape cookies.txt or a Cookie header string
• Export one site or every cookie in the browser
• Imports JSON from other cookie tools and Playwright storageState files
• Every failed cookie tells you why, instead of "Unknown error"

BACKUPS
• Back up now, or every hour, day or week
• Restore a backup or download it as JSON

WORKS YOUR WAY
• Popup, side panel or full tab, plus a Cookies tab in DevTools (you can turn it off)
• Normal and incognito cookie stores
• Light and dark themes; every button has a text label

PRIVATE BY DESIGN
Cookie Keeper has no servers and makes no network requests. No analytics, no ads, no accounts. Your cookies never leave your browser. The code is open source:
https://github.com/afieif/cookie-keeper

A word of warning: exported cookies are live logins. Never paste them into a website or send them to someone who asks for them.
```

**Graphics:**

| Field | File |
|---|---|
| Store icon (128×128) | `icon-128.png` |
| Screenshots (1280×800) | `screenshots/1-every-cookie.png` … `5-backups.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `promo-marquee-1400x560.png` |

**Official URL / homepage:** https://afieif.github.io/cookie-keeper/

**Support URL:** https://github.com/afieif/cookie-keeper/issues

## Privacy tab

**Single purpose:**

> Cookie Keeper lets you view and manage your browser's cookies: edit, pin, protect, block, import, export and back them up.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `cookies` | Reading, creating, editing and deleting cookies is the extension's whole purpose. |
| Host permission `<all_urls>` | Chrome only lets an extension manage cookies for sites it has host access to. Users manage cookies on any site, and can export or back up every cookie at once. The extension doesn't read or change page content. |
| `webNavigation` | Used only to list the frames embedded in the current tab, so cookies set by embedded sites can be shown. |
| `storage` | Saves pins, protected cookies, block rules, settings and backups locally. |
| `unlimitedStorage` | Cookie backups can be larger than the default local storage limit. |
| `alarms` | Runs scheduled backups if the user turns them on. |
| `sidePanel` | Lets the user open the cookie editor in the side panel. |

**Remote code:** No, I am not using remote code.

**Data usage:** tick **Authentication information** and **Website content**, which are handled only on the device. Then tick all three certifications: no selling or transferring to third parties, no use for unrelated purposes, no use for creditworthiness or lending.

**Privacy policy URL:** https://afieif.github.io/cookie-keeper/privacy.html
