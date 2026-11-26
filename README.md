<div align="center">

# Crowdfunding Blockchain

**Plataforma descentralizada de financiamento coletivo ("tudo ou nada") na rede Ethereum.**

Smart Contract em Solidity · Hardhat · Frontend React + MetaMask

[![CI](https://github.com)](https://github.com)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Como o Sistema Funciona

O sistema elimina intermediários financeiros por meio de um contrato inteligente (`Crowdfunding.sol`) que atua como custodiante dos fundos até o encerramento de cada campanha.

### Fluxo de Estados da Campanha
1. **Criação (`Active`):** Qualquer usuário cria uma campanha definindo título, meta em ETH e duração (1 a 90 dias). A taxa da plataforma vigente no momento (máx. 5%) fica congelada para aquela campanha.
2. **Arrecadação:** Apoiadores enviam ETH diretamente para o contrato enquanto o prazo estiver aberto.
3. **Encerramento:**
   - **Meta atingida após o prazo (`Successful` → `Completed`):** O criador saca o valor arrecadado (descontada a taxa da plataforma).
   - **Meta não atingida após o prazo (`Failed`):** Cada apoiador solicita o reembolso integral da sua contribuição.
   - **Cancelamento (`Cancelled`):** O criador pode cancelar a campanha a qualquer momento enquanto ativa, liberando o reembolso imediato aos apoiadores.

### Segurança e Arquitetura
- **Proteção contra Reentrância:** Uso de `ReentrancyGuard` nas operações financeiras (`withdraw`, `refund`).
- **Controle de Emergência Seguro:** Uso de `Pausable` que bloqueia novas criações e contribuições em caso de incidente, mas **nunca** impede saques ou reembolsos já devidos.
- **Governança:** `Ownable2Step` para transferência segura de propriedade do contrato.

---

## Stack Tecnológica

- **Smart Contracts:** Solidity `0.8.24`, OpenZeppelin, Hardhat
- **Frontend:** React, Vite, Ethers.js v6, MetaMask
- **Testes & Qualidade:** Chai/Mocha (46 testes de contrato), Vitest (13 testes de frontend), Solhint, GitHub Actions CI

---

## Estrutura do Projeto

```text
├── contracts/
│   ├── Crowdfunding.sol          # Contrato principal
│   └── mocks/                    # Contratos auxiliares para testes
├── test/                         # Suíte de testes unitários e invariantes
├── scripts/                      # Deploy, seed de dados, time-travel e exportação de ABI
├── frontend/                     # Interface web (React + Vite + Ethers v6)
├── docs/                         # Documentação detalhada (ARQUITETURA.md e SEGURANCA.md)
└── .github/workflows/            # Pipeline de CI/CD
```

---

## Execução Local (Passo a Passo)

**Pré-requisitos:** [Node.js 18+](https://nodejs.org) e extensão [MetaMask](https://metamask.io) instalada no navegador.

### 1. Instalação e Testes
```bash
npm install
npm run frontend:install

# Executar suíte de testes
npm test
npm run frontend:test
```

### 2. Subindo o Ambiente Local
Abra **3 terminais** na raiz do projeto:

```bash
# Terminal 1: Inicia o nó blockchain local (mantenha aberto)
npm run node

# Terminal 2: Faz o deploy do contrato e cria campanhas de exemplo
npm run deploy:local
npm run seed

# Terminal 3: Inicia o frontend em http://localhost:5173
npm run frontend:dev
```

### 3. Conectando a MetaMask
1. Na interface web, clique em **Trocar rede** (ou adicione manualmente: RPC `http://127.0.0.1:8545`, Chain ID `31337`, Símbolo `ETH`).
2. Importe uma das **Private Keys** exibidas no Terminal 1 na MetaMask *(a conta `#0` é a administradora do contrato)*.
3. **Simulando o fim dos prazos:** Para testar saques e reembolsos sem esperar dias reais, avance o relógio da blockchain local:
   ```bash
   npm run time-travel   # Avança 31 dias (ou use: DAYS=10 npm run time-travel)
   ```

---

## Deploy em Testnet (Sepolia)

1. Copie `.env.example` para `.env` e preencha `SEPOLIA_RPC_URL`, `PRIVATE_KEY` e `ETHERSCAN_API_KEY`.
2. Execute o deploy com verificação automática:
   ```bash
   npm run deploy:sepolia
   ```
3. Inicie o frontend apontando para a Sepolia (`Chain ID 11155111`):
   ```bash
   VITE_DEFAULT_CHAIN_ID=11155111 npm run frontend:dev
   ```

---

## Interface do Contrato (`Crowdfunding.sol`)

| Categoria | Funções Principais |
|---|---|
| **Usuários** | `createCampaign(...)`, `contribute(id)`, `withdraw(id)`, `refund(id)`, `cancelCampaign(id)` |
| **Leitura** | `getCampaign(id)`, `getCampaigns(offset, limit)`, `getStatus(id)`, `contributions(id, user)` |
| **Admin (`owner`)** | `setFeeBps(newFee)`, `withdrawFees(to)`, `pause()`, `unpause()` |

---

## Problemas Comuns

- **Erro de *nonce* na MetaMask após reiniciar o `npm run node`:** Vá na MetaMask em *Configurações → Avançado → Limpar dados da aba de atividade*.
- **Contrato não encontrado no frontend:** Verifique se `npm run deploy:local` foi executado após iniciar o `npm run node`.

---

## Documentação Adicional

- [Arquitetura e Diagramas](docs/ARQUITETURA.md)
- [Análise de Segurança e Ameaças](docs/SEGURANCA.md)
- [Guia de Contribuição](CONTRIBUTING.md) · [Política de Segurança](SECURITY.md)

Licenciado sob a licença **MIT**.
