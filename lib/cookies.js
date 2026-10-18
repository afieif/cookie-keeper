// Thin wrappers over chrome.cookies shared by the popup and the service worker.

export const bareDomain = d => d.replace(/^\./, '');

export const cookieKey = c =>
  [c.storeId ?? '', c.domain, c.path, c.name, c.partitionKey?.topLevelSite ?? ''].join('|');

export const cookieUrl = c => `${c.secure ? 'https' : 'http'}://${bareDomain(c.domain)}${c.path || '/'}`;

// Partitioned (CHIPS) cookies are only returned when a partitionKey is passed,
// so query both ways and merge.
export async function getAllCookies(filter = {}) {
  const lists = [await chrome.cookies.getAll(filter)];
  try {
    lists.push(await chrome.cookies.getAll({ ...filter, partitionKey: {} }));
  } catch {
    // Older Chrome without partitioned cookie support.
  }
  const byKey = new Map(lists.flat().map(c => [cookieKey(c), c]));
  return [...byKey.values()];
}

export function validateCookie(c) {
  if (typeof c.name !== 'string') return 'Missing cookie name';
  if (!c.domain) return 'Missing domain (and no website is open to import into)';
  if (/[;=\s]/.test(c.name)) return 'Name cannot contain spaces, ";" or "="';
  if (/[;\r\n]/.test(c.value)) return 'Value cannot contain ";" or line breaks';
  if (c.sameSite === 'no_restriction' && !c.secure) return 'SameSite=None requires Secure';
  if (c.partitionKey && !c.secure) return 'Partitioned cookies must be Secure';
  if (c.name.startsWith('__Secure-') && !c.secure) return '__Secure- cookies must be Secure';
  if (c.name.startsWith('__Host-') && (!c.secure || !c.hostOnly || c.path !== '/'))
    return '__Host- cookies must be Secure, host-only and use path /';
  if (!c.session) {
    if (!(c.expirationDate > 0)) return 'Set an expiry date or mark it as a session cookie';
    if (c.expirationDate < Date.now() / 1000) return 'Expiry date is in the past';
  }
  return null;
}

export async function setCookie(c) {
  const details = {
    url: cookieUrl(c),
    name: c.name,
    value: c.value ?? '',
    path: c.path || '/',
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
    sameSite: c.sameSite || 'unspecified',
  };
  if (!c.hostOnly) details.domain = c.domain;
  if (!c.session && c.expirationDate) details.expirationDate = c.expirationDate;
  if (c.storeId) details.storeId = c.storeId;
  if (c.partitionKey) details.partitionKey = c.partitionKey;
  const result = await chrome.cookies.set(details);
  if (!result) {
    throw new Error(chrome.runtime.lastError?.message ||
      'The browser rejected this cookie (check the domain, Secure flag and SameSite)');
  }
  return result;
}

export async function removeCookie(c) {
  const details = { url: cookieUrl(c), name: c.name };
  if (c.storeId) details.storeId = c.storeId;
  if (c.partitionKey) details.partitionKey = c.partitionKey;
  return chrome.cookies.remove(details);
}

// Block rules: { domain, name } where name may be '*' and domain covers subdomains.
export function matchesRule(rule, c) {
  const d = bareDomain(c.domain);
  return (rule.name === '*' || rule.name === c.name) &&
    (d === rule.domain || d.endsWith('.' + rule.domain));
}
