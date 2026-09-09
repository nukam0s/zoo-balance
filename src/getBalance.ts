import * as https from 'https';
import { CookieStore, Cookie } from './storage';

const CREDITS_URL = 'https://www.zoocode.dev/dashboard/credits';

interface HttpResponse {
  status: number;
  body: string;
  location?: string;
  setCookies: string[];
}

/**
 * Performs an HTTPS GET request, collecting Set-Cookie headers.
 */
function httpsGet(url: string, headers: Record<string, string>): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        // Node may provide multiple set-cookie values via the raw headers
        const raw = res.rawHeaders ?? [];
        const setCookies: string[] = [];
        for (let i = 0; i < raw.length; i += 2) {
          if (raw[i].toLowerCase() === 'set-cookie') {
            setCookies.push(raw[i + 1]);
          }
        }
        resolve({
          status: res.statusCode ?? 0,
          body,
          location: res.headers.location as string | undefined,
          setCookies,
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

export interface BalanceInfo {
  /** Current balance, e.g. "$5.00" */
  balance: string | null;
  /** Available credits, e.g. "$0.00" */
  availableCredits: string | null;
  /** When this info was fetched */
  fetchedAt: Date;
}

/**
 * Fetches balance info from the zoocode.dev credits page.
 * Renews cookies automatically: any Set-Cookie headers returned by the
 * server are merged back into the CookieStore, keeping the session alive.
 *
 * Throws when there is no session or the session is expired.
 */
export async function getBalanceInfo(store: CookieStore): Promise<BalanceInfo> {
  const cookies = await store.load();
  const cookieHeader = store.toHeader(cookies);

  if (!cookieHeader) {
    throw new Error('No session. Run "Zoo Balance: Login" first.');
  }

  let url = CREDITS_URL;
  let finalBody = '';
  let allSetCookies: string[] = [];

  // Follow up to 5 redirects
  for (let i = 0; i < 5; i++) {
    const res = await httpsGet(url, {
      Cookie: cookieHeader,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    });

    allSetCookies = allSetCookies.concat(res.setCookies);

    if (res.status >= 300 && res.status < 400 && res.location) {
      url = new URL(res.location, url).toString();
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      // Persist any cookies the server sent before failing (may include a logout)
      await store.mergeSetCookies(cookies, allSetCookies);
      throw new Error('Session expired (HTTP ' + res.status + '). Run "Zoo Balance: Login".');
    }

    finalBody = res.body;
    break;
  }

  // Renew the session: merge any refreshed cookies back into storage
  const renewed = await store.mergeSetCookies(cookies, allSetCookies);
  if (renewed) {
    console.log('[zoo-balance] session cookies renewed');
  }

  // Strip HTML tags so amounts can be matched across element boundaries
  const text = finalBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // "CURRENT BALANCE" followed by a $ amount
  const balanceMatch = text.match(/CURRENT\s*BALANCE[^$]*\$\s*([\d,]+(?:\.\d{2})?)/i);

  // "AVAILABLE CREDITS" followed by a $ amount
  const availableMatch = text.match(/AVAILABLE\s*CREDITS[^$]*\$\s*([\d,]+(?:\.\d{2})?)/i);

  return {
    balance: balanceMatch ? `$${balanceMatch[1]}` : null,
    availableCredits: availableMatch ? `$${availableMatch[1]}` : null,
    fetchedAt: new Date(),
  };
}
