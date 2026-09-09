# Zoo Balance

Shows your [Zoo Code](https://zoocode.dev) balance, usage analytics, and cache performance directly in the VSCode status bar.

## Features

- **Balance** — auto-updated balance in the status bar
- **Usage** — cost, tokens, and requests for the last N days, with per-mode breakdown
- **Cache performance** — read/write tokens and estimated savings
- **Auto-refresh** — periodic updates (configurable interval)
- **Session management** — cookies stored encrypted in VSCode SecretStorage with automatic renewal

## Setup

1. Install the extension in VSCode
2. Run **Zoo Balance: Login** (`Ctrl+Shift+P` → "Zoo Balance: Login") — the browser opens at zoocode.dev
3. Log in to the site
4. Open browser DevTools (`F12`) → **Network** tab → click any request to `zoocode.dev` → in **Request Headers**, copy the full value of the **Cookie** header
5. Paste that value into the input box that appears in VSCode
6. The balance appears in the status bar — click it for the full summary

> Cookies are stored encrypted in VSCode's SecretStorage and are automatically renewed.

## Commands

| Command | Description |
|---------|-------------|
| `Zoo Balance: Refresh` | Manually refresh the balance |
| `Zoo Balance: Show Summary` | Open the popup with balance + usage + cache |
| `Zoo Balance: Login` | Open the browser to log in and paste the Cookie header |
| `Zoo Balance: Logout` | Clear the stored session |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `zooBalance.refreshInterval` | `5` | Refresh interval in minutes |

## Requirements

- Account on [zoocode.dev](https://zoocode.dev)
- Browser login to import cookies

## License

MIT
