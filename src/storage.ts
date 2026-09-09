import * as vscode from 'vscode';

const SECRET_KEY_HEADER = 'zooBalance.cookieHeader';

/**
 * Manages the zoocode.dev cookie header in VSCode SecretStorage (encrypted, per-machine).
 * Stores the raw Cookie header string as copied from browser DevTools.
 */
export class CookieStore {
  constructor(private secrets: vscode.SecretStorage) {}

  /** Get the stored raw Cookie header string, or empty string if none. */
  async getCookieHeader(): Promise<string> {
    return (await this.secrets.get(SECRET_KEY_HEADER)) ?? '';
  }

  /** Store a raw Cookie header string (as copied from browser DevTools). */
  async saveCookieHeader(header: string): Promise<void> {
    await this.secrets.store(SECRET_KEY_HEADER, header);
  }

  /** Merge updated cookies from Set-Cookie response headers into the stored header. */
  async mergeSetCookies(currentHeader: string, setCookieHeaders: string[]): Promise<boolean> {
    if (setCookieHeaders.length === 0) {
      return false;
    }

    // Parse current header into a map
    const cookies = new Map<string, string>();
    for (const part of currentHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      cookies.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }

    let changed = false;
    for (const raw of setCookieHeaders) {
      const nameValue = raw.split(';')[0]?.trim();
      if (!nameValue) continue;
      const eq = nameValue.indexOf('=');
      if (eq <= 0) continue;
      const name = nameValue.slice(0, eq).trim();
      const value = nameValue.slice(eq + 1).trim();

      // Skip expired cookies (Max-Age=0 or Expires in the past)
      const lowerRaw = raw.toLowerCase();
      if (lowerRaw.includes('max-age=0')) {
        if (cookies.has(name)) {
          cookies.delete(name);
          changed = true;
        }
        continue;
      }

      if (cookies.get(name) !== value) {
        cookies.set(name, value);
        changed = true;
      }
    }

    if (changed) {
      const newHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      await this.saveCookieHeader(newHeader);
    }
    return changed;
  }

  /** Clear all stored cookies. */
  async clear(): Promise<void> {
    await this.secrets.delete(SECRET_KEY_HEADER);
  }
}
