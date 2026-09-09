import * as vscode from 'vscode';
import { getBalanceInfo, BalanceInfo } from './getBalance';
import { getUsageInfo, UsageInfo } from './getUsage';
import { CookieStore } from './storage';
import { showQuickSummary } from './quickSummary';

export function activate(ctx: vscode.ExtensionContext) {
  const store = new CookieStore(ctx.secrets);

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  bar.text = 'Zoo: ...';
  bar.tooltip = 'Zoo Code balance — click to refresh';
  bar.command = 'zooBalance.refresh';
  bar.show();

  let interval: ReturnType<typeof setInterval> | undefined;

  function getIntervalMs(): number {
    const config = vscode.workspace.getConfiguration('zooBalance');
    const minutes = config.get<number>('refreshInterval', 5);
    return Math.max(1, minutes) * 60_000;
  }

  function scheduleRefresh() {
    if (interval) {
      clearInterval(interval);
    }
    interval = setInterval(refresh, getIntervalMs());
  }

  let lastInfo: BalanceInfo | null = null;
  let lastUsage: UsageInfo | null = null;

  async function refresh() {
    try {
      const info = await getBalanceInfo(store);
      lastInfo = info;
      if (info.balance) {
        // Fetch usage analytics in the background (non-fatal if it fails)
        getUsageInfo(store)
          .then((usage) => { lastUsage = usage; })
          .catch((e) => {
            console.log('[zoo-balance] usage fetch failed:', e instanceof Error ? e.message : String(e));
          });
        bar.text = `Zoo: ${info.balance}`;
        bar.backgroundColor = undefined;
        bar.command = 'zooBalance.showSummary';
        bar.tooltip = new vscode.MarkdownString(
          `Zoo Code balance: **${info.balance}**\n\nLast checked: ${info.fetchedAt.toLocaleTimeString()}\n\nClick for summary`
        );
      } else {
        bar.text = 'Zoo: sessão expirada';
        bar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        bar.command = 'zooBalance.login';
        bar.tooltip = 'Session expired. Click to login.';
      }
    } catch (err) {
      bar.text = 'Zoo: erro';
      bar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      bar.command = 'zooBalance.login';
      bar.tooltip = `Error: ${err instanceof Error ? err.message : String(err)}\n\nClick to login.`;
    }
  }

  ctx.subscriptions.push(
    vscode.commands.registerCommand('zooBalance.refresh', refresh),
    vscode.commands.registerCommand('zooBalance.showSummary', async () => {
      // If usage hasn't been fetched yet (or failed earlier), fetch it now
      if (!lastUsage && lastInfo?.balance) {
        try {
          lastUsage = await getUsageInfo(store);
        } catch (e) {
          console.log('[zoo-balance] usage fetch failed:', e instanceof Error ? e.message : String(e));
        }
      }
      showQuickSummary(lastInfo, lastUsage);
    }),
    vscode.commands.registerCommand('zooBalance.logout', async () => {
      await store.clear();
      bar.text = 'Zoo: sem sessão';
      bar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      vscode.window.showInformationMessage('Zoo Balance: session cleared.');
    }),
    vscode.commands.registerCommand('zooBalance.login', async () => {
      // 1. Open the browser so the user can log in
      await vscode.env.openExternal(vscode.Uri.parse('https://www.zoocode.dev/dashboard/credits'));

      // 2. Ask the user to paste the Cookie header from DevTools
      const header = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        password: true,
        prompt: 'Paste the "Cookie" header value from DevTools (Network tab → any request to zoocode.dev → Request Headers → Cookie)',
        title: 'Zoo Balance: Login',
        placeHolder: 'name1=value1; name2=value2; ...',
      });

      if (!header || !header.includes('=')) {
        vscode.window.showErrorMessage('Zoo Balance: invalid Cookie header. Make sure you copied the full value.');
        return;
      }

      await store.saveCookieHeader(header);
      vscode.window.showInformationMessage('Zoo Balance: session saved. Fetching balance...');
      refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('zooBalance.refreshInterval')) {
        scheduleRefresh();
      }
    }),
    { dispose: () => interval && clearInterval(interval) }
  );

  refresh();
  scheduleRefresh();
}

export function deactivate() {}
