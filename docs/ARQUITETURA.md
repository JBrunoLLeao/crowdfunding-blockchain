# Arquitetura

## Visão geral

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  Frontend (React/Vite)  │        │  Blockchain (EVM)            │
│                         │  RPC   │                              │
│  useWallet  ────────────┼───────►│  Crowdfunding.sol            │
│  (MetaMask / EIP-1193)  │ assina │   ├─ campaigns[id]           │
│                         │ txs    │   ├─ contributions[id][addr] │
│  useCrowdfunding ───────┼───────►│   ├─ accruedFees             │
│  (leitura + escrita)    │ lê     │   └─ owner / paused          │
└─────────────────────────┘        └──────────────────────────────┘
        ▲                                        ▲
        │ abi.json + deployments.json            │ deploy.js
        └──────────── gerados por ───────────────┘
                 scripts/deploy.js | export-abi.js
```

- **Leitura** não exige carteira: o frontend usa um RPC público/local (`JsonRpcProvider`).
  Com a carteira conectada na rede certa, usa o provedor da própria carteira.
- **Escrita** (criar, contribuir, sacar, reembolsar, cancelar, admin) é sempre assinada pela carteira.
- O frontend consulta o contrato a cada 15 s e após cada transação confirmada.

## Máquina de estados de uma campanha

```
                 cancelCampaign()
        ┌───────────────────────────────┐
        │                               ▼
   ┌─────────┐  prazo + meta ok    ┌───────────┐   withdraw()   ┌───────────┐
   │ Active  │────────────────────►│ Successful│───────────────►│ Completed │
   └────┬────┘                     └───────────┘                └───────────┘
        │ prazo + meta NÃO atingida
        ▼
   ┌─────────┐                     ┌───────────┐
   │ Failed  │  refund() liberado  │ Cancelled │  refund() liberado
   └─────────┘                     └───────────┘
```

O status **não é armazenado**: é calculado em `_status()` a partir de `cancelled`, `withdrawn`,
`deadline`, `goal` e `totalRaised`. Isso evita estados inconsistentes e transações de "fechamento".

## Quem pode o quê

| Ação | Quem | Quando |
|---|---|---|
| `createCampaign` | qualquer um | contrato não pausado |
| `contribute` | qualquer um | campanha `Active`, contrato não pausado |
| `cancelCampaign` | criador | campanha `Active` |
| `withdraw` | criador | `Successful` (sempre, mesmo pausado) |
| `refund` | apoiador | `Failed` ou `Cancelled` (sempre, mesmo pausado) |
| `setFeeBps`, `pause`, `unpause`, `withdrawFees` | owner | a qualquer momento |

## Modelo econômico

- Taxa em *basis points* (1 bp = 0,01%). Padrão: 250 bps = 2,5%. Teto: 500 bps = 5%.
- A taxa vigente é **copiada para a campanha** ao criá-la: mudanças futuras do owner não afetam
  campanhas em andamento.
- A taxa só é cobrada no `withdraw`. Em campanhas falhas/canceladas não há taxa: o reembolso é integral.
- Campanhas superfinanciadas entregam ao criador todo o valor arrecadado (menos a taxa).

## Decisões de design

| Decisão | Motivo |
|---|---|
| Um único contrato para todas as campanhas | Deploy barato; leitura simples (`getCampaigns`) |
| Status calculado, não armazenado | Sem estados desatualizados; menos gás |
| Struct empacotada (slot único) | Economiza gás de escrita/leitura |
| Pull payments | Nenhum loop sobre apoiadores; sem risco de DoS |
| Pausa não bloqueia saída de fundos | O admin não consegue "prender" o dinheiro dos usuários |
| Erros customizados | Menor custo de gás e mensagens traduzíveis no frontend |

## Estrutura de pastas

```
contracts/            Crowdfunding.sol + mocks/ (apenas para testes)
test/                 Testes do contrato (Hardhat + Chai)
scripts/              deploy, seed, time-travel, export-abi
deployments/          Endereços implantados por rede (localhost é ignorado pelo git)
frontend/src/
  contracts/          abi.json + deployments.json (gerados pelos scripts)
  hooks/              useWallet, useCrowdfunding
  components/         Header, CampaignCard, CampaignModal, CreateCampaignForm, AdminPanel…
  lib/                config, format, errors (+ testes Vitest)
```
