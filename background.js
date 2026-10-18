import { cookieKey, setCookie, removeCookie, matchesRule } from './lib/cookies.js';
import { getSettings, backupNow } from './lib/backups.js';

const same = (a, b) =>
  a.value === b.value && a.secure === b.secure && a.httpOnly === b.httpOnly &&
  a.sameSite === b.sameSite &&
  (a.session ? b.session : Math.floor(a.expirationDate) === Math.floor(b.expirationDate));

// Guard against a restore loop if the browser normalises a field we compare.
const restores = new Map();
function allowRestore(key) {
  const now = Date.now();
  const recent = (restores.get(key) || []).filter(t => now - t < 5000);
  recent.push(now);
  restores.set(key, recent);
  return recent.length <= 3;
}

chrome.cookies.onChanged.addListener(async ({ removed, cookie, cause }) => {
  // Read fresh each time: the popup writes storage before it touches a cookie,
  // so this always sees the user's own edits as already approved.
  const { protected: locked = {}, blocked = [] } = await chrome.storage.local.get(['protected', 'blocked']);
  const key = cookieKey(cookie);
  const snapshot = locked[key];

  if (snapshot) {
    // An overwrite is followed by an "added" event, which is checked instead.
    // Natural expiry is allowed; a site forcing expiry (expired_overwrite) is not.
    if (removed && (cause === 'overwrite' || cause === 'expired')) return;
    if (!removed && same(cookie, snapshot)) return;
    if (!allowRestore(key)) return;
    await setCookie(snapshot).catch(e => console.warn('Could not restore protected cookie', snapshot.name, e));
    return;
  }

  if (!removed && blocked.some(rule => matchesRule(rule, cookie))) {
    await removeCookie(cookie).catch(() => {});
  }
});

// ---------- Scheduled backups ----------

const BACKUP_ALARM = 'backup';
const PERIODS = { hourly: 60, daily: 1440, weekly: 10080 };

async function scheduleBackups() {
  const minutes = PERIODS[(await getSettings()).backupEvery];
  const existing = await chrome.alarms.get(BACKUP_ALARM);
  if (existing?.periodInMinutes === minutes) return;
  await chrome.alarms.clear(BACKUP_ALARM);
  if (minutes) chrome.alarms.create(BACKUP_ALARM, { delayInMinutes: 1, periodInMinutes: minutes });
}

chrome.runtime.onInstalled.addListener(scheduleBackups);
chrome.runtime.onStartup.addListener(scheduleBackups);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) scheduleBackups();
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === BACKUP_ALARM) backupNow('scheduled').catch(e => console.warn('Backup failed', e));
});
