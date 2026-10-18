import { getSettings } from './lib/backups.js';

// Some users don't want the extra DevTools tab (#91), so it can be turned off in Settings.
if ((await getSettings()).devtoolsPanel) {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  chrome.devtools.panels.create('Cookies', 'icons/32.png', `popup.html?mode=devtools&tabId=${tabId}`);
}
