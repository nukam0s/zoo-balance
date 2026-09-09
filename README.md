# Zoo Balance

Mostra o teu saldo, usage e cache performance do [Zoo Code](https://zoocode.dev) diretamente na status bar do VSCode.

## Features

- **Balance** — saldo atualizado automaticamente na status bar
- **Usage** — custo, tokens e requests dos últimos N dias, com breakdown por modo
- **Cache performance** — read/write tokens e savings estimados
- **Auto-refresh** — atualiza periodicamente (intervalo configurável)
- **Session management** — cookies guardados no SecretStorage do VSCode com renovação automática

## Setup

1. Instala a extensão no VSCode
2. Corre o comando **Zoo Balance: Login** (`Ctrl+Shift+P` → "Zoo Balance: Login") — o browser abre em zoocode.dev
3. Faz login no site
4. Abre o DevTools do browser (`F12`) → tab **Network** → clica em qualquer pedido a `zoocode.dev` → em **Request Headers**, copia o valor inteiro do header **Cookie**
5. Cola esse valor na caixa de input que aparece no VSCode
6. O saldo aparece na status bar — clica para ver o resumo completo

> Os cookies ficam guardados de forma encriptada no SecretStorage do VSCode e são renovados automaticamente.

## Comandos

| Comando | Descrição |
|---------|-----------|
| `Zoo Balance: Refresh` | Atualiza o saldo manualmente |
| `Zoo Balance: Show Summary` | Abre o popup com balance + usage + cache |
| `Zoo Balance: Login` | Abre o browser para login e pede o Cookie header |
| `Zoo Balance: Logout` | Limpa a sessão guardada |

## Configuração

| Setting | Default | Descrição |
|---------|---------|-----------|
| `zooBalance.refreshInterval` | `5` | Intervalo em minutos para atualizar o saldo |

## Requisitos

- Conta em [zoocode.dev](https://zoocode.dev)
- Login via browser para importar os cookies

## License

MIT
