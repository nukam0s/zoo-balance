import * as https from 'https';
import { CookieStore } from './storage';

const USAGE_URL = 'https://www.zoocode.dev/dashboard/usage';

// Next.js Server Action IDs (from the zoocode.dev client bundle).
// These are stable per deployment; if the site is redeployed they may change.
const ACTION_IDS = {
  getDailyUsageAction: '60007c8f0e883e529ea669c9f3a41aba9652a1ad4a',
  getCostByModeAction: '6036a4079cfde3c5c87b8f98ccb2240baa34a71cbe',
  getCacheSavingsAction: '60dc22c6e2b591613966191b1f6974beb05f86560b',
};

export interface DailyUsagePoint {
  date: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface ModeUsage {
  mode: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface CacheSavings {
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  estimatedSavings: number;
}

export interface UsageInfo {
  period: number;
  daily: DailyUsagePoint[];
  modes: ModeUsage[];
  cache: CacheSavings;
  fetchedAt: Date;
}

interface ActionResponse {
  status: number;
  body: string;
  setCookies: string[];
}

function postAction(url: string, headers: Record<string, string>, body: string): Promise<ActionResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'POST', headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const raw = res.rawHeaders ?? [];
          const setCookies: string[] = [];
          for (let i = 0; i < raw.length; i += 2) {
            if (raw[i].toLowerCase() === 'set-cookie') {
              setCookies.push(raw[i + 1]);
            }
          }
          resolve({ status: res.statusCode ?? 0, body: data, setCookies });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Calls a Next.js Server Action and extracts the action result from the
 * RSC flight response. The result is the line starting with "1:".
 */
async function callServerAction(
  actionId: string,
  args: unknown[],
  cookieHeader: string
): Promise<string | null> {
  const body = JSON.stringify(args);
  const res = await postAction(USAGE_URL, {
    Cookie: cookieHeader,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
    'Next-Action': actionId,
    'Content-Type': 'text/plain;charset=UTF-8',
    Accept: 'text/x-component',
    'Content-Length': String(Buffer.byteLength(body)),
  }, body);

  if (res.status !== 200) {
    throw new Error(`Server action failed (HTTP ${res.status})`);
  }

  // The action result is the flight line keyed "1:"
  const match = res.body.match(/^1:(.*)$/m);
  return match ? match[1] : null;
}

function parseJsonOrNull<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Fetches usage analytics (daily usage, cost by mode, cache savings)
 * from the zoocode.dev usage page via Next.js server actions.
 *
 * Throws when there is no session or the session is expired.
 */
export async function getUsageInfo(store: CookieStore, period = 7): Promise<UsageInfo> {
  const cookieHeader = await store.getCookieHeader();

  if (!cookieHeader) {
    throw new Error('No session. Run "Zoo Balance: Login" first.');
  }

  const allSetCookies: string[] = [];

  const runAction = async (actionId: string, args: unknown[]): Promise<string | null> => {
    const body = JSON.stringify(args);
    const res = await postAction(USAGE_URL, {
      Cookie: cookieHeader,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
      'Next-Action': actionId,
      'Content-Type': 'text/plain;charset=UTF-8',
      Accept: 'text/x-component',
      'Content-Length': String(Buffer.byteLength(body)),
    }, body);

    allSetCookies.push(...res.setCookies);

    if (res.status === 401 || res.status === 403) {
      await store.mergeSetCookies(cookieHeader, allSetCookies);
      throw new Error('Session expired (HTTP ' + res.status + '). Run "Zoo Balance: Login".');
    }
    if (res.status !== 200) {
      throw new Error(`Server action failed (HTTP ${res.status})`);
    }

    const match = res.body.match(/^1:(.*)$/m);
    return match ? match[1] : null;
  };

  const [dailyRaw, modesRaw, cacheRaw] = await Promise.all([
    runAction(ACTION_IDS.getDailyUsageAction, [period, 'personal']),
    runAction(ACTION_IDS.getCostByModeAction, [period, 'personal']),
    runAction(ACTION_IDS.getCacheSavingsAction, [period, 'personal']),
  ]);

  // Renew the session: merge any refreshed cookies back into storage
  const renewed = await store.mergeSetCookies(cookieHeader, allSetCookies);
  if (renewed) {
    console.log('[zoo-balance] session cookies renewed (usage)');
  }

  const daily = parseJsonOrNull<DailyUsagePoint[]>(dailyRaw) ?? [];
  const modes = parseJsonOrNull<ModeUsage[]>(modesRaw) ?? [];
  const cache =
    parseJsonOrNull<CacheSavings>(cacheRaw) ?? {
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      estimatedSavings: 0,
    };

  return { period, daily, modes, cache, fetchedAt: new Date() };
}
