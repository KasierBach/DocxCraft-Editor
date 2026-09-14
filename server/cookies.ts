/** Minimal cookie helpers shared by the auth routes and the document guard. */

export function readCookies(header: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(header) ? header.join('; ') : (header ?? '');
  const cookies: Record<string, string> = {};

  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name) {
      cookies[name] = decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return cookies;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { secure: boolean; maxAgeSeconds: number },
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function clearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
