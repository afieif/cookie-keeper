# Cookie Keeper Privacy Policy

_Last updated: October 18, 2026_

Cookie Keeper is a browser extension for viewing, editing, protecting, blocking, importing, exporting and backing up your browser's cookies. This policy explains what data it handles and what it does with that data.

**The short version:** Cookie Keeper has no servers. It never sends your cookies or any other data off your device. It doesn't collect analytics, show ads, or share or sell anything.

## What data Cookie Keeper handles

To do its job, Cookie Keeper reads and changes your browser's cookies. Cookies can contain **authentication information** (such as session tokens that keep you logged in) and **website content**. Cookie Keeper also reads the address of the tab you're viewing, and of the frames embedded in it, so it can show the cookies that belong to that site.

All of this stays on your device. Cookie Keeper only works with this data when you use the extension, or when you've set up a feature that runs automatically (Protect, Block or scheduled backups, described below).

## What Cookie Keeper stores

Cookie Keeper saves the following with the browser's local extension storage (`chrome.storage.local`):

| Data | Why | Contains cookie values? |
|---|---|---|
| Pinned cookies | To keep them at the top and out of "Delete all" | No: only the cookie's name, domain and path |
| Protected cookies | To restore a cookie if a site changes or deletes it | **Yes**: a copy of the protected cookie |
| Block rules | To delete cookies you've blocked | No: only a domain and a cookie name |
| Backups | To let you restore cookies later | **Yes**: copies of your cookies (incognito cookies are never backed up) |
| Settings | Your preferences, such as backup frequency and the DevTools panel | No |

This storage:

- stays on your device and is **not** synced to your Google account or to any other device;
- is not readable by websites or by other extensions;
- is deleted when you uninstall Cookie Keeper. You can also delete individual backups, unpin or unprotect cookies, and remove block rules at any time.

Cookie Keeper never stores the addresses of pages you visit.

## Exports, copies and imports

When you **export** or **download** cookies, Cookie Keeper creates a file on your computer. When you **copy** cookies, it puts them on your clipboard. What happens to that file or clipboard text afterwards is up to you. Cookie Keeper does not upload it anywhere.

**Treat exported cookies like passwords.** Anyone who has your login cookies can use your accounts. Never paste them into a website or send them to someone who asks for them.

When you **import** cookies, Cookie Keeper reads only the text or file you give it, and only adds the cookies it contains to your browser.

## Permissions and why they're needed

| Permission | Why |
|---|---|
| `cookies` | To read, create, change and delete cookies |
| Access to all websites (`<all_urls>`) | Browsers only let extensions manage cookies for sites they have access to. Cookie Keeper doesn't read or change the content of web pages. |
| `webNavigation` | To find the frames embedded in the current page, so their cookies can be shown too |
| `storage`, `unlimitedStorage` | To save pins, protected cookies, block rules, settings and backups locally (see above). Backups can be larger than the default storage limit. |
| `alarms` | To run scheduled backups, if you turn them on |
| `sidePanel` | To show Cookie Keeper in the browser's side panel |

## What Cookie Keeper does not do

- It doesn't send data to the developer or to anyone else, and it makes no network requests.
- It doesn't use analytics, tracking or advertising.
- It doesn't sell, transfer or share user data with third parties.
- It doesn't use or transfer user data for purposes unrelated to its single purpose of managing cookies.
- It doesn't use or transfer user data to determine creditworthiness or for lending purposes.
- It doesn't load or run code from outside the extension.

The use of information received from browser APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.

## Children

Cookie Keeper doesn't knowingly collect any information from anyone, including children.

## Changes to this policy

If this policy changes, the updated version will be published at this address with a new "Last updated" date. If a future version of Cookie Keeper ever needed to handle data differently, this policy would be updated before that version was released.

## Contact

Questions about this policy: [fifdev@proton.me](mailto:fifdev@proton.me)
