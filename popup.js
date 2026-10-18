import {
  bareDomain, cookieKey, getAllCookies, setCookie, removeCookie, validateCookie, matchesRule,
} from './lib/cookies.js';
import { toJSON, toNetscape, toHeader, parseCookies } from './lib/formats.js';
import { getSettings, listBackups, readBackup, backupNow, deleteBackup } from './lib/backups.js';

const params = new URLSearchParams(location.search);
// popup: the toolbar popup. tab / devtools: bound to one tab (?tabId=).
// side: the side panel, which follows whichever tab is active in its window.
const mode = document.documentElement.dataset.mode || params.get('mode') || (params.has('tabId') ? 'tab' : 'popup');
const PAGE = 200;
const $ = sel => document.querySelector(sel);

const state = {
  tab: null, siteUrl: null, host: '', frameUrls: [],
  stores: [], storeId: undefined,
  scope: 'site', query: '', cookies: [],
  pinned: {}, locked: {}, blocked: [],
  open: new Set(), dirty: new Set(), editors: new Map(),
  limit: PAGE, panel: params.get('panel'), stale: false,
};

// ---------- DOM helpers (never innerHTML: cookie values are untrusted) ----------

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);
const check = (name, label, checked) =>
  h('label', { class: 'check' }, h('input', { type: 'checkbox', name, checked }), label);
const select = (name, value, options) =>
  h('select', { name }, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function toLocalInput(seconds) {
  try {
    const d = new Date(seconds * 1000);
    return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
  } catch {
    return '';
  }
}
const fromLocalInput = v => (v ? new Date(v).getTime() / 1000 : undefined);

let statusTimer;
function say(message, kind = 'ok') {
  const el = $('#status');
  el.textContent = message;
  el.dataset.kind = kind;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (el.textContent = ''), 4000);
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    say(message);
  } catch {
    say('The browser blocked clipboard access', 'error');
  }
}

// ---------- Prefs ----------

async function setPinned(pinned) {
  state.pinned = pinned;
  await chrome.storage.local.set({ pinned });
}
async function setLocked(locked) {
  state.locked = locked;
  await chrome.storage.local.set({ protected: locked });
}
async function setBlocked(blocked) {
  state.blocked = blocked;
  await chrome.storage.local.set({ blocked });
  renderPanel();
}

async function togglePin(key) {
  const pinned = { ...state.pinned };
  if (pinned[key]) delete pinned[key];
  else pinned[key] = true;
  await setPinned(pinned);
  renderList();
}

async function toggleProtect(c) {
  const key = cookieKey(c);
  const locked = { ...state.locked };
  if (locked[key]) delete locked[key];
  else locked[key] = { ...c };
  await setLocked(locked);
  say(locked[key] ? `"${c.name}" is protected — sites can't change or delete it` : `"${c.name}" is no longer protected`);
  renderList();
}

async function addBlockRule(rule) {
  if (!rule.domain || !rule.name) return;
  if (!state.blocked.some(r => r.domain === rule.domain && r.name === rule.name)) {
    await setBlocked([...state.blocked, rule]);
  }
  const existing = await getAllCookies({ domain: rule.domain, storeId: state.storeId });
  await Promise.allSettled(existing.filter(c => matchesRule(rule, c)).map(deleteCookie));
  say(`Blocked ${rule.name === '*' ? 'all cookies' : `"${rule.name}"`} on ${rule.domain}`);
}

// ---------- Cookie operations ----------

async function saveCookie(original, next) {
  const oldKey = original && cookieKey(original);
  const newKey = cookieKey(next);
  const prevLocked = state.locked;
  // Update the protected snapshot first so the service worker doesn't revert our own edit.
  if (original && state.locked[oldKey]) {
    const locked = { ...state.locked };
    delete locked[oldKey];
    locked[newKey] = next;
    await setLocked(locked);
  }
  if (original && oldKey !== newKey && state.pinned[oldKey]) {
    const pinned = { ...state.pinned };
    delete pinned[oldKey];
    pinned[newKey] = true;
    await setPinned(pinned);
  }
  if (original && oldKey !== newKey) await removeCookie(original);
  try {
    await setCookie(next);
  } catch (e) {
    if (original && oldKey !== newKey) await setCookie(original).catch(() => {});
    if (prevLocked !== state.locked) await setLocked(prevLocked);
    throw e;
  }
}

async function deleteCookie(c) {
  const key = cookieKey(c);
  if (state.locked[key]) {
    const locked = { ...state.locked };
    delete locked[key];
    await setLocked(locked);
  }
  if (state.pinned[key]) {
    const pinned = { ...state.pinned };
    delete pinned[key];
    await setPinned(pinned);
  }
  await removeCookie(c);
}

// ---------- Loading ----------

async function setSite(tab) {
  state.tab = tab;
  const url = tab?.url;
  state.siteUrl = url && /^https?:/.test(url) ? url : null;
  state.host = state.siteUrl ? new URL(url).hostname : '';
  const frames = state.siteUrl
    ? await chrome.webNavigation.getAllFrames({ tabId: tab.id }).catch(() => null)
    : null;
  const origins = (frames || [])
    .map(f => f.url)
    .filter(u => /^https?:/.test(u))
    .map(u => new URL(u).origin + '/');
  state.frameUrls = [...new Set(origins)].filter(u => new URL(u).hostname !== state.host);
  $('#site').textContent = state.host || 'No website in this tab';
}

async function loadCookies() {
  const storeId = state.storeId;
  if (state.scope === 'all') return getAllCookies({ storeId });
  if (!state.host) return [];

  // URL filters return cookies the page (and its iframes) would receive...
  const urls = [state.siteUrl, ...state.frameUrls];
  const byUrl = (await Promise.all(urls.map(url => getAllCookies({ url, storeId })))).flat();

  // ...but miss cookies on other paths or plain-http ones, so also pull the host itself.
  let root = state.host;
  if (state.scope === 'subdomains') {
    for (const c of byUrl) {
      const d = bareDomain(c.domain);
      if (!c.hostOnly && state.host.endsWith(d) && d.length < root.length) root = d;
    }
  }
  const byDomain = await getAllCookies({ domain: root, storeId });
  const own = state.scope === 'subdomains'
    ? byDomain
    : byDomain.filter(c => bareDomain(c.domain) === state.host);

  return [...new Map([...byUrl, ...own].map(c => [cookieKey(c), c])).values()];
}

async function refresh() {
  // Don't rebuild the list under someone's unsaved edit.
  if (state.dirty.size) {
    state.stale = true;
    renderSummary(visibleCookies());
    return;
  }
  state.stale = false;
  state.cookies = await loadCookies();
  renderList();
}

let refreshTimer;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 150);
}

function visibleCookies() {
  const q = state.query.trim().toLowerCase();
  const list = q
    ? state.cookies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.domain.toLowerCase().includes(q) ||
      c.value.toLowerCase().includes(q))
    : state.cookies.slice();
  return list.sort((a, b) =>
    (!!state.pinned[cookieKey(b)] - !!state.pinned[cookieKey(a)]) ||
    bareDomain(a.domain).localeCompare(bareDomain(b.domain)) ||
    a.name.localeCompare(b.name));
}

// ---------- Rendering: list ----------

function renderSummary(shown) {
  const parts = [plural(shown.length, 'cookie')];
  if (state.query.trim()) parts[0] += ` matching of ${state.cookies.length}`;
  const pinned = shown.filter(c => state.pinned[cookieKey(c)]).length;
  const locked = shown.filter(c => state.locked[cookieKey(c)]).length;
  if (pinned) parts.push(`${pinned} pinned`);
  if (locked) parts.push(`${locked} protected`);
  if (state.scope !== 'all' && state.frameUrls.length) {
    parts.push(`includes ${plural(state.frameUrls.length, 'embedded site')}`);
  }
  if (state.stale) parts.push('cookies changed — save or cancel your edit to refresh');
  $('#summary').textContent = parts.join(' · ');
}

function emptyMessage() {
  if (state.scope !== 'all' && !state.host) {
    return 'This tab isn’t a website. Switch to “All sites” to browse every cookie.';
  }
  if (state.query.trim()) return 'No cookies match your search.';
  return 'No cookies for this site.';
}

function renderList() {
  const shown = visibleCookies();
  renderSummary(shown);
  const list = $('#list');
  list.replaceChildren();
  if (!shown.length) list.append(h('li', { class: 'empty' }, emptyMessage()));
  for (const c of shown.slice(0, state.limit)) list.append(renderRow(c));
  const rest = shown.length - state.limit;
  if (rest > 0) {
    list.append(h('li', {}, h('button', {
      class: 'more',
      onclick: () => { state.limit += PAGE; renderList(); },
    }, `Show ${Math.min(PAGE, rest)} more (${rest} hidden)`)));
  }
  if (state.panel === 'delete') renderPanel();
}

function renderRow(c) {
  const key = cookieKey(c);
  const isOpen = state.open.has(key);
  const pinned = !!state.pinned[key];
  const tags = [
    state.locked[key] && h('span', { class: 'tag lock', title: 'Protected: changes made by sites are reverted' }, 'protected'),
    c.partitionKey && h('span', { class: 'tag', title: `Partitioned under ${c.partitionKey.topLevelSite}` }, 'partitioned'),
    c.httpOnly && h('span', { class: 'tag' }, 'HttpOnly'),
    c.session && h('span', { class: 'tag' }, 'session'),
  ];
  return h('li', { class: 'cookie' + (isOpen ? ' open' : '') },
    h('div', { class: 'summary' },
      h('button', {
        class: 'icon pin' + (pinned ? ' on' : ''),
        title: pinned ? 'Unpin' : 'Pin: keep at the top and skip it in “Delete all”',
        'aria-label': pinned ? 'Unpin cookie' : 'Pin cookie',
        'aria-pressed': String(pinned),
        onclick: () => togglePin(key),
      }, pinned ? '★' : '☆'),
      h('button', { class: 'name', 'aria-expanded': String(isOpen), onclick: () => toggleOpen(key) },
        h('span', { class: 'n' }, c.name || '(no name)'),
        h('span', { class: 'meta' }, bareDomain(c.domain) + (c.path !== '/' ? c.path : '')),
        tags),
      h('code', { class: 'val', title: c.value }, c.value),
      h('button', {
        class: 'icon', title: 'Copy value', 'aria-label': 'Copy value',
        onclick: () => copy(c.value, `Copied value of "${c.name}"`),
      }, '⧉')),
    isOpen && editorFor(c));
}

function editorFor(c) {
  const key = cookieKey(c);
  if (state.dirty.has(key) && state.editors.has(key)) return state.editors.get(key);
  const form = renderEditor(c);
  state.editors.set(key, form);
  return form;
}

function toggleOpen(key) {
  if (state.open.has(key)) closeEditor(key);
  else state.open.add(key);
  renderList();
}

function closeEditor(key) {
  state.open.delete(key);
  state.dirty.delete(key);
  state.editors.delete(key);
  if (state.stale && !state.dirty.size) scheduleRefresh();
}

// ---------- Rendering: editor ----------

function renderEditor(c, isNew = false) {
  const key = isNew ? 'new' : cookieKey(c);
  const error = h('p', { class: 'error', role: 'alert' });
  const form = h('form', {
    class: 'editor',
    oninput: () => state.dirty.add(key),
    onchange: e => {
      if (e.target.name === 'session') form.elements.expires.disabled = e.target.checked;
    },
    onsubmit: async e => {
      e.preventDefault();
      error.textContent = '';
      const next = readForm(form, c);
      const problem = validateCookie(next);
      if (problem) return void (error.textContent = problem);
      try {
        await saveCookie(isNew ? null : c, next);
      } catch (err) {
        error.textContent = err.message;
        return;
      }
      if (isNew) {
        state.dirty.delete(key);
        state.panel = null;
        renderPanel();
      } else {
        closeEditor(key);
      }
      say(isNew ? `Created "${next.name}"` : `Saved "${next.name}"`);
      await refresh();
    },
  },
  field('Name', h('input', { name: 'name', value: c.name, spellcheck: false, autocomplete: 'off' })),
  field('Value', h('textarea', { name: 'value', value: c.value, rows: 3, spellcheck: false })),
  h('div', { class: 'grid' },
    field('Domain', h('input', { name: 'domain', value: c.domain, required: true, spellcheck: false })),
    field('Path', h('input', { name: 'path', value: c.path || '/', spellcheck: false })),
    field('Expires', h('input', {
      type: 'datetime-local', name: 'expires', step: 1, disabled: c.session,
      value: c.session || !c.expirationDate ? '' : toLocalInput(c.expirationDate),
    })),
    field('SameSite', select('sameSite', c.sameSite, [
      ['unspecified', 'Unspecified'], ['lax', 'Lax'], ['strict', 'Strict'], ['no_restriction', 'None'],
    ])),
    field('Partition (top-level site)', h('input', {
      name: 'partition', value: c.partitionKey?.topLevelSite ?? '', placeholder: 'Not partitioned', spellcheck: false,
    }))),
  h('div', { class: 'checks' },
    check('session', 'Session', c.session),
    check('hostOnly', 'Host-only', c.hostOnly),
    check('secure', 'Secure', c.secure),
    check('httpOnly', 'HttpOnly', c.httpOnly)),
  error,
  h('div', { class: 'actions' },
    h('button', { type: 'submit', class: 'primary' }, isNew ? 'Create' : 'Save'),
    h('button', {
      type: 'button',
      onclick: () => {
        if (isNew) { state.dirty.delete(key); state.panel = null; renderPanel(); }
        else { closeEditor(key); renderList(); }
      },
    }, 'Cancel'),
    !isNew && h('span', { class: 'spacer' }),
    !isNew && h('button', {
      type: 'button',
      title: 'Copy this cookie as JSON',
      onclick: () => copy(toJSON([c]), `Copied "${c.name}" as JSON`),
    }, 'Copy JSON'),
    !isNew && h('button', {
      type: 'button',
      title: 'Revert any change a site makes to this cookie, including deleting it',
      onclick: () => toggleProtect(c),
    }, state.locked[key] ? 'Unprotect' : 'Protect'),
    !isNew && h('button', {
      type: 'button',
      title: 'Delete it now and every time this domain sets it again',
      onclick: () => addBlockRule({ domain: bareDomain(c.domain), name: c.name }),
    }, 'Block'),
    !isNew && h('button', {
      type: 'button', class: 'danger',
      onclick: async () => {
        await deleteCookie(c);
        closeEditor(key);
        say(`Deleted "${c.name}"`);
      },
    }, 'Delete')));
  return form;
}

function readForm(form, base) {
  const el = form.elements;
  const session = el.session.checked;
  const hostOnly = el.hostOnly.checked;
  const partition = el.partition.value.trim();
  let domain = el.domain.value.trim();
  domain = hostOnly ? bareDomain(domain) : '.' + bareDomain(domain);
  return {
    name: el.name.value.trim(),
    value: el.value.value,
    domain,
    hostOnly,
    path: el.path.value.trim() || '/',
    secure: el.secure.checked,
    httpOnly: el.httpOnly.checked,
    sameSite: el.sameSite.value,
    session,
    expirationDate: session ? undefined : fromLocalInput(el.expires.value),
    storeId: base.storeId ?? state.storeId,
    partitionKey: partition ? { ...base.partitionKey, topLevelSite: partition } : undefined,
  };
}

// ---------- Rendering: panels ----------

function setPanel(name) {
  if (state.panel === 'add') state.dirty.delete('new');
  state.panel = state.panel === name ? null : name;
  renderPanel();
}

function renderPanel() {
  for (const b of document.querySelectorAll('[data-panel]')) {
    b.setAttribute('aria-pressed', String(b.dataset.panel === state.panel));
  }
  const build = {
    add: addPanel, import: importPanel, export: exportPanel, delete: deletePanel, blocked: blockedPanel,
    backups: backupsPanel, settings: settingsPanel,
  }[state.panel];
  const panel = $('#panel');
  // Keep an in-progress "add" form across re-renders.
  if (state.panel === 'add' && state.dirty.has('new') && panel.firstChild) return;
  panel.replaceChildren();
  panel.hidden = !build;
  if (build) panel.append(build());
}

function addPanel() {
  const draft = {
    name: '', value: '', domain: state.host, hostOnly: true, path: '/',
    secure: !!state.siteUrl?.startsWith('https:'), httpOnly: false, sameSite: 'lax',
    session: false, expirationDate: Date.now() / 1000 + 30 * 864e2, storeId: state.storeId,
  };
  return h('div', {}, h('h2', {}, 'New cookie'), renderEditor(draft, true));
}

function deletePanel() {
  const shown = visibleCookies();
  const kept = shown.filter(c => state.pinned[cookieKey(c)] || state.locked[cookieKey(c)]);
  const doomed = shown.filter(c => !kept.includes(c));
  return h('div', { class: 'confirm' },
    h('h2', {}, doomed.length ? `Delete ${plural(doomed.length, 'cookie')}?` : 'Nothing to delete'),
    h('p', {}, 'Only the cookies listed below are deleted — narrow them with the scope or search first.',
      kept.length ? ` ${kept.length} pinned or protected ${kept.length === 1 ? 'cookie is' : 'cookies are'} kept.` : '',
      ' Pin a cookie (☆) to keep it.'),
    h('div', { class: 'actions' },
      h('button', {
        class: 'danger', disabled: !doomed.length,
        onclick: async () => {
          const results = await Promise.allSettled(doomed.map(removeCookie));
          const failed = results.filter(r => r.status === 'rejected').length;
          setPanel(null);
          say(`Deleted ${doomed.length - failed} cookies` + (failed ? `, ${failed} failed` : ''), failed ? 'error' : 'ok');
        },
      }, 'Delete'),
      h('button', { onclick: () => setPanel(null) }, 'Cancel')));
}

function exportPanel() {
  const format = select('format', 'json', [
    ['json', 'JSON'], ['netscape', 'Netscape (cookies.txt)'], ['header', 'Header string'],
  ]);
  const which = select('which', 'listed', [
    ['listed', `Listed cookies (${visibleCookies().length})`],
    ['store', 'Every cookie, all sites'],
  ]);
  async function build() {
    const cookies = which.value === 'store'
      ? await getAllCookies({ storeId: state.storeId })
      : visibleCookies();
    const text = { json: toJSON, netscape: toNetscape, header: toHeader }[format.value](cookies);
    return { text, count: cookies.length };
  }
  return h('div', {},
    h('h2', {}, 'Export'),
    h('div', { class: 'row' }, field('Format', format), field('Cookies', which)),
    h('p', { class: 'warn' },
      'Exported cookies are live logins: anyone who has them can use your accounts without a password. ' +
      'Never paste them into a website or send them to someone who asks for them.'),
    h('div', { class: 'actions' },
      h('button', {
        class: 'primary',
        onclick: async () => { const { text, count } = await build(); copy(text, `Copied ${plural(count, 'cookie')}`); },
      }, 'Copy'),
      h('button', {
        onclick: async () => { const { text, count } = await build(); download(text, format.value); say(`Saved ${plural(count, 'cookie')}`); },
      }, 'Download')));
}

function download(text, format, label) {
  label ??= state.scope === 'all' || !state.host ? 'all-sites' : state.host;
  const ext = format === 'json' ? 'json' : 'txt';
  const a = h('a', {
    href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })),
    download: `cookies-${label}-${new Date().toISOString().slice(0, 10)}.${ext}`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importPanel() {
  const report = h('div', { class: 'report', role: 'status' });
  const readFile = async file => { if (file) text.value = await file.text(); };
  const text = h('textarea', {
    rows: 7, spellcheck: false,
    placeholder: 'Paste or drop a file: JSON (Cookie-Editor, EditThisCookie, Playwright), Netscape cookies.txt, or a Cookie header string',
    ondragover: e => e.preventDefault(),
    ondrop: e => { e.preventDefault(); readFile(e.dataTransfer.files[0]); },
  });
  // File pickers close extension popups, so in the popup this hands off to a tab.
  const fileControl = mode !== 'popup'
    ? h('input', { type: 'file', accept: '.json,.txt,text/plain,application/json', onchange: e => readFile(e.target.files[0]) })
    : h('button', { type: 'button', onclick: () => openInTab('import') }, 'Choose file…');
  return h('div', {},
    h('h2', {}, 'Import'),
    h('p', { class: 'hint' }, `Cookies go into the ${storeLabel(state.storeId).toLowerCase()} store. Cookies without a domain are added to ${state.host || 'the current site'}.`),
    text,
    h('div', { class: 'actions' },
      h('button', { class: 'primary', onclick: () => runImport(text.value, report) }, 'Import'),
      fileControl),
    report);
}

async function runImport(text, report) {
  report.replaceChildren();
  let parsed;
  try {
    parsed = parseCookies(text, state.siteUrl);
  } catch (e) {
    report.append(h('p', { class: 'error' }, `Couldn’t read that as JSON, Netscape or a header string. ${e.message}`));
    return;
  }
  const results = await Promise.all(parsed.cookies.map(async c => {
    const next = { ...c, storeId: state.storeId };
    const problem = validateCookie(next);
    if (problem) return { c, problem };
    try {
      await setCookie(next);
      return { c };
    } catch (e) {
      return { c, problem: e.message };
    }
  }));
  const failed = results.filter(r => r.problem);
  report.append(h('p', { class: failed.length ? 'warn' : 'ok' },
    `Imported ${results.length - failed.length} of ${plural(results.length, 'cookie')} (${parsed.format}).`));
  if (failed.length) {
    report.append(h('ul', { class: 'failures' }, failed.map(({ c, problem }) =>
      h('li', {}, h('code', {}, c.name || '(no name)'), ` ${c.domain || '?'} — ${problem}`))));
  }
  await refresh();
}

function blockedPanel() {
  const domain = h('input', { value: state.host, placeholder: 'example.com', required: true, spellcheck: false });
  const name = h('input', { placeholder: 'Cookie name, or * for all', required: true, spellcheck: false });
  return h('div', {},
    h('h2', {}, 'Blocked cookies'),
    h('p', { class: 'hint' }, 'Matching cookies are deleted as soon as a site sets them. Rules cover subdomains.'),
    state.blocked.length
      ? h('ul', { class: 'rules' }, state.blocked.map((rule, i) => h('li', {},
        h('code', {}, rule.name), ' on ', h('code', {}, rule.domain),
        h('button', {
          class: 'link', onclick: () => setBlocked(state.blocked.filter((_, j) => j !== i)),
        }, 'Remove'))))
      : h('p', { class: 'muted' }, 'No rules yet.'),
    h('form', {
      class: 'row',
      onsubmit: e => {
        e.preventDefault();
        addBlockRule({ domain: bareDomain(domain.value.trim().toLowerCase()), name: name.value.trim() });
      },
    }, field('Domain', domain), field('Name', name), h('button', { type: 'submit' }, 'Block')));
}

function backupsPanel() {
  const list = h('ul', { class: 'rules' });
  const report = h('div', { class: 'report', role: 'status' });
  const every = select('backupEvery', 'off', [
    ['off', 'Off'], ['hourly', 'Every hour'], ['daily', 'Every day'], ['weekly', 'Every week'],
  ]);
  const keep = h('input', { type: 'number', min: 1, max: 50 });
  const domains = h('input', { placeholder: 'All sites', spellcheck: false });

  async function load() {
    const [settings, backups] = await Promise.all([getSettings(), listBackups()]);
    every.value = settings.backupEvery;
    keep.value = settings.backupKeep;
    domains.value = settings.backupDomains;
    list.replaceChildren(...backups.length
      ? backups.map(b => h('li', {},
        `${new Date(b.id).toLocaleString()} · ${plural(b.count, 'cookie')}${b.reason === 'scheduled' ? ' · automatic' : ''}`,
        h('button', { class: 'link', onclick: () => restoreBackup(b, report) }, 'Restore'),
        h('button', {
          class: 'link',
          onclick: async () => download(toJSON(await readBackup(b.id)), 'json', `backup-${new Date(b.id).toISOString().slice(0, 10)}`),
        }, 'Download'),
        h('button', { class: 'link', onclick: async () => { await deleteBackup(b.id); load(); } }, 'Delete')))
      : [h('li', { class: 'muted' }, 'No backups yet.')]);
  }
  load();

  return h('div', {},
    h('h2', {}, 'Backups'),
    h('p', { class: 'hint' },
      'Snapshots of your normal (non-incognito) cookies, kept inside the browser. ' +
      'Restoring re-creates cookies that haven’t expired and leaves newer ones alone.'),
    h('form', {
      class: 'row',
      onsubmit: e => e.preventDefault(),
      onchange: () => saveSettings({
        backupEvery: every.value,
        backupKeep: Math.min(50, Math.max(1, Number(keep.value) || 5)),
        backupDomains: domains.value.trim(),
      }),
    }, field('Automatic backup', every), field('Keep last', keep), field('Only these domains', domains)),
    h('div', { class: 'actions' },
      h('button', {
        class: 'primary',
        onclick: async () => {
          const b = await backupNow('manual');
          say(`Backed up ${plural(b.count, 'cookie')}`);
          load();
        },
      }, 'Back up now')),
    list,
    report);
}

async function restoreBackup(backup, report) {
  const cookies = await readBackup(backup.id);
  const now = Date.now() / 1000;
  const live = cookies.filter(c => c.session || c.expirationDate > now);
  const results = await Promise.allSettled(live.map(setCookie));
  const failed = results.filter(r => r.status === 'rejected').length;
  const expired = cookies.length - live.length;
  report.replaceChildren(h('p', { class: failed ? 'warn' : 'ok' },
    `Restored ${live.length - failed} of ${plural(cookies.length, 'cookie')}` +
    (expired ? ` (${expired} had expired)` : '') + (failed ? `, ${failed} failed` : '') + '.'));
}

async function saveSettings(patch) {
  await chrome.storage.local.set({ settings: { ...await getSettings(), ...patch } });
  say('Settings saved');
}

function settingsPanel() {
  const devtools = h('input', {
    type: 'checkbox',
    onchange: () => saveSettings({ devtoolsPanel: devtools.checked }),
  });
  getSettings().then(s => { devtools.checked = s.devtoolsPanel; });
  return h('div', {},
    h('h2', {}, 'Settings'),
    h('label', { class: 'check' }, devtools, 'Show a “Cookies” tab in DevTools'),
    h('p', { class: 'hint' }, 'Takes effect the next time DevTools opens.'),
    h('p', { class: 'muted' }, `Cookie Keeper ${chrome.runtime.getManifest().version}`));
}

// ---------- Setup ----------

const storeLabel = id => (id === '0' ? 'Normal' : id === '1' ? 'Incognito' : `Store ${id}`);

async function openInTab(panel) {
  const query = new URLSearchParams({ tabId: state.tab?.id ?? '' });
  if (panel) query.set('panel', panel);
  await chrome.tabs.create({ url: chrome.runtime.getURL(`popup.html?${query}`) });
  if (mode === 'popup') window.close();
}

function openSidePanel() {
  // Must run synchronously inside the click to count as a user gesture.
  chrome.sidePanel.open({ windowId: state.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT })
    .then(() => window.close())
    .catch(e => say(`Couldn’t open the side panel: ${e.message}`, 'error'));
}

async function switchTab(tab) {
  state.open.clear();
  state.dirty.clear();
  state.editors.clear();
  state.limit = PAGE;
  await setSite(tab);
  renderPanel();
  await refresh();
}

async function init() {
  document.body.classList.add(`mode-${mode}`);
  $('#openTab').hidden = mode === 'tab';
  $('#openSide').hidden = mode !== 'popup' || !chrome.sidePanel?.open;

  const saved = await chrome.storage.local.get(['pinned', 'protected', 'blocked', 'scope']);
  state.pinned = saved.pinned || {};
  state.locked = saved.protected || {};
  state.blocked = saved.blocked || [];
  state.scope = saved.scope || 'site';

  const tab = params.has('tabId')
    ? await chrome.tabs.get(Number(params.get('tabId'))).catch(() => null)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  await setSite(tab);

  state.stores = await chrome.cookies.getAllCookieStores();
  state.storeId = state.stores.find(s => s.tabIds.includes(tab?.id))?.id ?? state.stores[0]?.id;
  const store = $('#store');
  store.hidden = state.stores.length < 2;
  store.replaceChildren(...state.stores.map(s =>
    h('option', { value: s.id, selected: s.id === state.storeId }, storeLabel(s.id))));
  store.onchange = () => { state.storeId = store.value; state.limit = PAGE; refresh(); };

  const scope = $('#scope');
  scope.value = state.scope;
  scope.onchange = () => {
    state.scope = scope.value;
    state.limit = PAGE;
    chrome.storage.local.set({ scope: state.scope });
    refresh();
  };

  const search = $('#search');
  search.oninput = () => { state.query = search.value; state.limit = PAGE; renderList(); };

  for (const b of document.querySelectorAll('[data-panel]')) b.onclick = () => setPanel(b.dataset.panel);
  $('#openTab').onclick = () => openInTab(state.panel);
  $('#openSide').onclick = openSidePanel;

  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.target.closest('input, textarea, select')) {
      e.preventDefault();
      search.focus();
    } else if (e.key === 'Escape' && state.panel && !state.dirty.has('new')) {
      e.preventDefault();
      setPanel(null);
    }
  });

  // Keep the list in sync with the browser instead of showing a stale snapshot.
  chrome.cookies.onChanged.addListener(scheduleRefresh);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.pinned) state.pinned = changes.pinned.newValue || {};
    if (changes.protected) state.locked = changes.protected.newValue || {};
    if (changes.blocked) state.blocked = changes.blocked.newValue || [];
    if (changes.pinned || changes.protected) renderList();
  });
  // Follow navigations (and, in the side panel, tab switches) so the site stays current.
  chrome.tabs.onUpdated.addListener((id, info, updated) => {
    if (id !== state.tab?.id || info.status !== 'complete') return;
    // Same site (reload, in-site navigation): keep open editors, just pick up new frames.
    if (updated.url && state.siteUrl && new URL(updated.url).hostname === state.host) {
      setSite(updated).then(scheduleRefresh);
    } else {
      switchTab(updated);
    }
  });
  if (mode === 'side') {
    const windowId = tab?.windowId ?? (await chrome.windows.getCurrent()).id;
    chrome.tabs.onActivated.addListener(async info => {
      if (info.windowId === windowId) switchTab(await chrome.tabs.get(info.tabId));
    });
  }

  renderPanel();
  await refresh();
}

init().catch(e => {
  console.error(e);
  say(`Something went wrong: ${e.message}`, 'error');
});
