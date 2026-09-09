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
2. Exporta o teu `session.json` do Zoo Code (Playwright storageState com cookies do zoocode.dev)
3. Corre o comando **Zoo Balance: Login** e seleciona o ficheiro `session.json`
4. O saldo aparece na status bar — clica para ver o resumo completo

## Comandos

| Comando | Descrição |
|---------|-----------|
| `Zoo Balance: Refresh` | Atualiza o saldo manualmente |
| `Zoo Balance: Show Summary` | Abre o popup com balance + usage + cache |
| `Zoo Balance: Login` | Importa cookies de um `session.json` |
| `Zoo Balance: Logout` | Limpa a sessão guardada |

## Configuração

| Setting | Default | Descrição |
|---------|---------|-----------|
| `zooBalance.refreshInterval` | `5` | Intervalo em minutos para atualizar o saldo |

## Requisitos

- Conta em [zoocode.dev](https://zoocode.dev)
- Ficheiro `session.json` com cookies válidos

## License

MIT
