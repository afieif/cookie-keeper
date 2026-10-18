// Cookie snapshots kept in chrome.storage.local. The index lives under "backups";
// each snapshot's cookies live under "backup:<id>" so listing stays cheap.
import { bareDomain, getAllCookies } from './cookies.js';

export const DEFAULT_SETTINGS = { backupEvery: 'off', backupKeep: 5, backupDomains: '', devtoolsPanel: true };

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function listBackups() {
  const { backups = [] } = await chrome.storage.local.get('backups');
  return backups;
}

export async function readBackup(id) {
  const key = `backup:${id}`;
  return (await chrome.storage.local.get(key))[key] || [];
}

// backupDomains is a comma/space separated list; empty means every site.
export function domainFilter(list) {
  const domains = list.split(/[\s,]+/).map(d => bareDomain(d.trim().toLowerCase())).filter(Boolean);
  if (!domains.length) return () => true;
  return c => {
    const d = bareDomain(c.domain);
    return domains.some(x => d === x || d.endsWith('.' + x));
  };
}

export async function backupNow(reason) {
  const settings = await getSettings();
  // The default store only: incognito cookies are meant to vanish.
  const cookies = (await getAllCookies({ storeId: '0' })).filter(domainFilter(settings.backupDomains));
  const id = Date.now();
  const backups = [{ id, reason, count: cookies.length }, ...await listBackups()];
  const dropped = backups.splice(Math.max(1, settings.backupKeep));
  await chrome.storage.local.set({ backups, [`backup:${id}`]: cookies });
  if (dropped.length) await chrome.storage.local.remove(dropped.map(b => `backup:${b.id}`));
  return backups[0];
}

export async function deleteBackup(id) {
  const backups = (await listBackups()).filter(b => b.id !== id);
  await chrome.storage.local.set({ backups });
  await chrome.storage.local.remove(`backup:${id}`);
}
