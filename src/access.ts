/** A support link selects a destination, never an identity, permission or consent. */
export function supportLink(value: string | null): { companyId: string } | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    const web =
      url.protocol === 'https:' &&
      ['dziri.app', 'www.dziri.app'].includes(url.hostname) &&
      !url.port;
    const native = url.protocol === 'dziri-messenger:' && url.hostname === 'support' && !url.port;
    const match = web
      ? url.pathname.match(/^\/support\/([a-zA-Z0-9]{1,128})\/?$/)
      : native
        ? url.pathname.match(/^\/([a-zA-Z0-9]{1,128})\/?$/)
        : null;
    return match ? { companyId: match[1] } : null;
  } catch {
    return null;
  }
}

export function staffRole(account: {
  role: string;
  status: string;
}): 'administrator' | 'agent' | null {
  if (account.status !== 'active') return null;
  return account.role === 'administrator' || account.role === 'agent' ? account.role : null;
}
