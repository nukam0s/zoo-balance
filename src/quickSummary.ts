import * as vscode from 'vscode';
import type { BalanceInfo } from './getBalance';
import type { UsageInfo } from './getUsage';

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}k`; }
  return String(n);
}

/**
 * Shows a compact QuickPick overlay with balance + usage info.
 * Uses ignoreFocusOut so it stays open when clicking around.
 */
export function showQuickSummary(info: BalanceInfo | null, usage: UsageInfo | null) {
  const items: vscode.QuickPickItem[] = [];

  // ── Balance ──
  if (info) {
    const bal = info.balance ?? '—';
    const avail = info.availableCredits ? `  |  Available: ${info.availableCredits}` : '';
    items.push({
      label: `$(wallet)  ${bal}${avail}`,
      description: info.fetchedAt.toLocaleTimeString(),
    });
  }

  // ── Usage ──
  if (usage) {
    const totalCost = usage.daily.reduce((s, d) => s + (d.cost ?? 0), 0);
    const totalTokens = usage.daily.reduce((s, d) => s + (d.tokens ?? 0), 0);
    const totalReqs = usage.daily.reduce((s, d) => s + (d.requests ?? 0), 0);

    if (totalCost > 0 || totalTokens > 0 || totalReqs > 0) {
      const parts: string[] = [];
      if (totalCost > 0) { parts.push(fmtMoney(totalCost)); }
      if (totalTokens > 0) { parts.push(`${fmtTokens(totalTokens)} tok`); }
      if (totalReqs > 0) { parts.push(`${totalReqs} reqs`); }
      items.push({
        label: `$(graph)  Usage last ${usage.period}d`,
        description: parts.join('  ·  '),
      });
    }

    // Mode breakdown (top 5 by cost)
    const activeModes = usage.modes
      .filter((m) => (m.cost ?? 0) > 0)
      .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
      .slice(0, 5);
    if (activeModes.length > 0) {
      items.push({ label: 'By mode', kind: vscode.QuickPickItemKind.Separator });
      for (const m of activeModes) {
        items.push({
          label: `  $(server-process)  ${m.mode}`,
          description: `${fmtMoney(m.cost ?? 0)}  ·  ${fmtTokens(m.tokens ?? 0)} tok  ·  ${m.requests ?? 0} reqs`,
        });
      }
    }

    // Cache (always shown)
    const { totalCacheReadTokens: r, totalCacheWriteTokens: w, estimatedSavings: s } = usage.cache;
    items.push({
      label: `$(database)  Cache performance`,
      description: `R: ${fmtTokens(r)}  ·  W: ${fmtTokens(w)}${s > 0 ? `  ·  ${fmtMoney(s)} saved` : ''}`,
    });

    // If everything is empty, hint the user
    if (usage.daily.length === 0 && usage.modes.length === 0 && r === 0 && w === 0) {
      items.push({
        label: '  $(info)  No usage data for this period yet',
      });
    }
  }

  if (items.length === 0) {
    items.push({ label: 'No data yet — click Zoo to refresh' });
  }

  const pick = vscode.window.createQuickPick();
  pick.title = 'Zoo Balance';
  pick.items = items;
  pick.placeholder = 'Balance · Usage · Cache';
  pick.busy = !info && !usage;
  pick.canSelectMany = false;
  pick.ignoreFocusOut = true;

  pick.onDidAccept(() => { pick.hide(); });

  pick.show();
}
