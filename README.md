# AI Mission Manager

Aplicação desktop construída com Bun, Electrobun, React e Vite+.

## Requisitos

- Bun 1.3 ou superior
- Hutch/Electrobun 2.0.2 (o comando `electrobun` instala o Hutch pareado)

## Desenvolvimento

```sh
bun install
bun run dev
```

O comando inicia o servidor Vite+ em `127.0.0.1:5173` e abre o app Electrobun
apontado para esse servidor, com HMR do renderer.

## Comandos

```sh
bun run check  # formatação, lint e tipos
bun run test   # Vitest e verificações auxiliares
bun run build  # renderer Vite+ e bundle Electrobun
bun run start  # executa o bundle de desenvolvimento/produção existente
```

O processo Bun fica em `src/bun/`; regras de domínio e persistência continuam em
`src/main/`. O renderer React fica em `src/renderer/` e conversa com o processo
Bun por RPC tipado do Electrobun, mantendo a superfície `window.desktop`.
O banco SQLite usa `bun:sqlite` tanto no app quanto nos testes e mantém o caminho
compatível com instalações anteriores em `~/.ai-mission-manager/mission-manager.sqlite`.

Os recursos vendorizados de pstack são copiados para o bundle e verificados na
inicialização. O manifesto e os arquivos de recursos usados pelos comandos
também são empacotados por `electrobun.config.ts`.

O Electrobun 2.0.2 não oferece bloqueio de instância única na API TypeScript;
duas inicializações podem abrir duas janelas e compartilhar o mesmo banco. O
fechamento da última janela encerra o processo.
