import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const SECRET_KEY = 'zooBalance.cookies';

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

/**
 * Manages zoocode.dev cookies in VSCode SecretStorage (encrypted, per-machine).
 * On first use, migrates cookies from a legacy session.json if present.
 */
export class CookieStore {
  constructor(private secrets: vscode.SecretStorage) {}

  /** Load cookies, migrating from session.json on first run. */
  async load(): Promise<Cookie[]> {
    const stored = await this.secrets.get(SECRET_KEY);
    if (stored) {
      return JSON.parse(stored) as Cookie[];
    }

    // Migration: read legacy session.json in the workspace root
    // (__dirname is <workspace>/out, so one level up is the workspace root)
    const legacy = path.join(__dirname, '..', 'session.json');
    const migrated = await this.importFromFile(legacy);
    if (migrated) {
      return this.load();
    }

    return [];
  }

  /**
   * Import cookies from a Playwright storageState file (session.json).
   * Returns true if cookies were imported.
   */
  async importFromFile(filePath: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    try {
      const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const cookies: Cookie[] = state.cookies ?? [];
      if (cookies.length > 0) {
        await this.save(cookies);
        return true;
      }
    } catch {
      // ignore malformed file
    }
    return false;
  }

  async save(cookies: Cookie[]): Promise<void> {
    await this.secrets.store(SECRET_KEY, JSON.stringify(cookies));
  }

  async clear(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
  }

  /** Build a Cookie header for zoocode.dev, skipping expired cookies. */
  toHeader(cookies: Cookie[]): string {
    const now = Date.now() / 1000;
    return cookies
      .filter((c) => c.domain.includes('zoocode.dev'))
      .filter((c) => !c.expires || c.expires > now)
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  /**
   * Merge Set-Cookie headers (raw strings) into the stored cookie list.
   * Returns true if any cookie was updated.
   */
  async mergeSetCookies(cookies: Cookie[], setCookieHeaders: string[]): Promise<boolean> {
    if (setCookieHeaders.length === 0) {
      return false;
    }

    const byKey = new Map(cookies.map((c) => [`${c.domain}|${c.path}|${c.name}`, c]));
    let changed = false;

    for (const raw of setCookieHeaders) {
      const parsed = parseSetCookie(raw);
      if (!parsed) {
        continue;
      }
      const key = `${parsed.domain}|${parsed.path}|${parsed.name}`;
      const existing = byKey.get(key);
      if (!existing || existing.value !== parsed.value || existing.expires !== parsed.expires) {
        byKey.set(key, parsed);
        changed = true;
      }
    }

    if (changed) {
      await this.save([...byKey.values()]);
    }
    return changed;
  }
}

/**
 * Parses a raw Set-Cookie header value into a Cookie object.
 */
function parseSetCookie(raw: string): Cookie | null {
  const parts = raw.split(';').map((p) => p.trim());
  const [nameValue, ...attrs] = parts;
  const eq = nameValue.indexOf('=');
  if (eq <= 0) {
    return null;
  }

  const cookie: Cookie = {
    name: nameValue.slice(0, eq).trim(),
    value: nameValue.slice(eq + 1).trim(),
    domain: 'www.zoocode.dev',
    path: '/',
  };

  for (const attr of attrs) {
    const [k, v = ''] = attr.split('=').map((s) => s.trim());
    switch (k.toLowerCase()) {
      case 'domain':
        cookie.domain = v.startsWith('.') ? v.slice(1) : v;
        break;
      case 'path':
        cookie.path = v;
        break;
      case 'expires':
        cookie.expires = Math.floor(Date.parse(v) / 1000);
        break;
      case 'max-age': {
        const maxAge = parseInt(v, 10);
        if (!isNaN(maxAge)) {
          cookie.expires = maxAge > 0 ? Math.floor(Date.now() / 1000) + maxAge : 0;
        }
        break;
      }
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'samesite':
        cookie.sameSite = v;
        break;
    }
  }

  return cookie;
}
