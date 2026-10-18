// Import/export formats. No chrome.* calls here so it can be tested in Node.

const SAME_SITE = {
  none: 'no_restriction', no_restriction: 'no_restriction',
  lax: 'lax', strict: 'strict', unspecified: 'unspecified',
};

export function toJSON(cookies) {
  return JSON.stringify(cookies.map(c => ({
    domain: c.domain,
    expirationDate: c.session ? undefined : c.expirationDate,
    hostOnly: c.hostOnly,
    httpOnly: c.httpOnly,
    name: c.name,
    path: c.path,
    sameSite: c.sameSite,
    secure: c.secure,
    session: c.session,
    storeId: c.storeId,
    value: c.value,
    partitionKey: c.partitionKey,
  })), null, 2);
}

export function toNetscape(cookies) {
  const lines = cookies.map(c => [
    (c.httpOnly ? '#HttpOnly_' : '') + c.domain,
    c.hostOnly ? 'FALSE' : 'TRUE',
    c.path,
    c.secure ? 'TRUE' : 'FALSE',
    c.session ? 0 : Math.floor(c.expirationDate),
    c.name,
    c.value,
  ].join('\t'));
  return [
    '# Netscape HTTP Cookie File',
    '# These cookies can log someone into your accounts. Keep this file private.',
    '',
    ...lines,
  ].join('\n') + '\n';
}

export const toHeader = cookies => cookies.map(c => `${c.name}=${c.value}`).join('; ');

// Detects JSON (Cookie-Editor, EditThisCookie, Playwright storageState),
// Netscape cookies.txt, or a raw "Cookie:" header string.
export function parseCookies(text, siteUrl) {
  text = text.trim();
  if (!text) throw new Error('Nothing to import.');
  if (text[0] === '[' || text[0] === '{') {
    let data = JSON.parse(text);
    if (!Array.isArray(data)) data = Array.isArray(data.cookies) ? data.cookies : [data];
    return { format: 'JSON', cookies: data.map(c => normalize(c, siteUrl)) };
  }
  const lines = text.split(/\r?\n/);
  if (/^#\s*(Netscape )?HTTP Cookie File/i.test(text) || lines.some(l => l.split('\t').length >= 7)) {
    return { format: 'Netscape', cookies: parseNetscape(lines) };
  }
  return { format: 'header string', cookies: parseHeader(text, siteUrl) };
}

function parseNetscape(lines) {
  return lines
    .filter(l => l.trim() && (!l.startsWith('#') || l.startsWith('#HttpOnly_')))
    .map(l => {
      const httpOnly = l.startsWith('#HttpOnly_');
      const [domain, flag, path, secure, expiry, name, ...rest] =
        (httpOnly ? l.slice('#HttpOnly_'.length) : l).split('\t');
      return normalize({
        domain,
        hostOnly: flag?.toUpperCase() !== 'TRUE',
        path,
        secure: secure?.toUpperCase() === 'TRUE',
        httpOnly,
        expirationDate: Number(expiry) > 0 ? Number(expiry) : undefined,
        name,
        value: rest.join('\t').trimEnd(),
      });
    });
}

function parseHeader(text, siteUrl) {
  if (!siteUrl) throw new Error('A header string needs a website open in the current tab.');
  const { hostname, protocol } = new URL(siteUrl);
  return text.replace(/^cookie:\s*/i, '').split(';').map(p => p.trim()).filter(Boolean).map(pair => {
    const i = pair.indexOf('=');
    return normalize({
      name: i < 0 ? '' : pair.slice(0, i).trim(),
      value: i < 0 ? pair : pair.slice(i + 1).trim(),
      domain: hostname,
      hostOnly: true,
      secure: protocol === 'https:',
      session: true,
    });
  });
}

function normalize(c, siteUrl) {
  let domain = String(c.domain ?? c.host ?? '').trim();
  let { hostOnly, secure } = c;
  if (!domain && siteUrl) {
    const url = new URL(siteUrl);
    domain = url.hostname;
    hostOnly = true;
    secure ??= url.protocol === 'https:';
  }
  if (domain.startsWith('.')) hostOnly = false;
  else if (hostOnly === undefined) hostOnly = true;

  let expires = Number(c.expirationDate ?? c.expires ?? c.expiry);
  if (expires > 1e11) expires /= 1000; // milliseconds
  const session = c.session ?? !(expires > 0);

  return {
    name: c.name,
    value: c.value == null ? '' : String(c.value),
    domain,
    hostOnly,
    path: c.path || '/',
    secure: !!secure,
    httpOnly: !!c.httpOnly,
    sameSite: SAME_SITE[String(c.sameSite ?? 'unspecified').toLowerCase()] ?? 'unspecified',
    session: !!session,
    expirationDate: session ? undefined : expires,
    partitionKey: c.partitionKey || undefined,
  };
}
