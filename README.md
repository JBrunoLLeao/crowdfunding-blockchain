<div align="center">

# ◆ Crowdfunding Blockchain

**Plataforma de crowdfunding descentralizada "tudo ou nada" na Ethereum**
Smart contract em Solidity · Hardhat · Frontend React + MetaMask

[![CI](https://github.com/SEU_USUARIO/crowdfunding-blockchain/actions/workflows/ci.yml/badge.svg)](https://github.com/SEU_USUARIO/crowdfunding-blockchain/actions)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)
![License](https://img.shields.io/badge/license-MIT-green)

</div>


## O que é

Um sistema em que qualquer pessoa cria uma campanha com **meta** e **prazo**, e qualquer pessoa pode apoiar com ETH. As regras vivem no contrato inteligente, sem intermediários:

-  **Meta atingida** até o prazo → o criador saca os fundos (menos a taxa da plataforma).
-  **Meta não atingida** → cada apoiador recupera integralmente sua contribuição.
-  **Cancelamento** → o criador pode cancelar uma campanha ativa; todos são reembolsados.

### Recursos

| Contrato | Frontend | Projeto |
|---|---|---|
| Modelo tudo ou nada | Listagem com filtros e busca | 46 testes de contrato + 13 do frontend |
| Cancelamento + reembolso | Barra de progresso e contagem regressiva | Deploy local e Sepolia (com verificação) |
| Taxa configurável (máx. 5%), congelada por campanha | Conexão MetaMask e troca de rede | Scripts de seed e *time-travel* |
| `Pausable` que nunca bloqueia saques | Criar, contribuir, sacar, reembolsar, cancelar | CI no GitHub Actions |
| `Ownable2Step` + `ReentrancyGuard` | Painel de administrador | Documentação de arquitetura e segurança |
| Leitura paginada e erros customizados | Mensagens de erro em português | Dependabot, solhint, templates de PR/issue |

## Estrutura

```
├── contracts/
│   ├── Crowdfunding.sol            # contrato principal
│   └── mocks/                      # contratos usados só nos testes
├── test/Crowdfunding.test.js       # 46 testes
├── scripts/
│   ├── deploy.js                   # deploy + salva endereço/ABI no frontend
│   ├── seed.js                     # campanhas de demonstração (rede local)
│   ├── time-travel.js              # avança o relógio (rede local)
│   └── export-abi.js               # copia o ABI para o frontend
├── frontend/                       # app React + Vite + ethers v6
├── docs/ARQUITETURA.md             # diagramas, estados, decisões de design
├── docs/SEGURANCA.md               # ameaças, mitigações, limitações
├── .github/                        # CI, Dependabot, templates
├── hardhat.config.js
└── .env.example
```

##  Início rápido (rede local, sem custo)

Pré-requisitos: [Node.js 18+](https://nodejs.org) e a extensão [MetaMask](https://metamask.io).

```bash
# 1) Instalar dependências
npm install
npm run frontend:install

# 2) Rodar os testes
npm test
npm run frontend:test
```

Agora abra **3 terminais** na raiz do projeto:

```bash
# Terminal 1 – blockchain local (mantenha aberto)
npm run node

# Terminal 2 – implantar o contrato e criar campanhas de exemplo
npm run deploy:local
npm run seed

# Terminal 3 – frontend em http://localhost:5173
npm run frontend:dev
```

### Configurando a MetaMask para a rede local

1. Adicione a rede: **RPC** `http://127.0.0.1:8545`, **Chain ID** `31337`, moeda `ETH`
   (o botão *Trocar rede* do app faz isso por você).
2. Importe uma conta de teste: no Terminal 1, copie uma das **Private Keys** exibidas pelo `npm run node`
   e use *Importar conta* na MetaMask. (Essas chaves são públicas, **nunca** envie fundos reais para elas.)
   - A conta `#0` é a **administradora** do contrato (vê a aba *Admin*).
3. Se reiniciar o `npm run node`, a blockchain recomeça do zero: refaça `deploy:local` e `seed`
   e, na MetaMask, use *Configurações → Avançado → Limpar dados da aba de atividade*.

### Testando saques e reembolsos

As campanhas de exemplo têm prazos de 7 a 60 dias. Para ver o fim delas sem esperar:

```bash
npm run time-travel            # avança 31 dias (ou: DAYS=10 npm run time-travel)
```

Recarregue o app: campanhas com meta atingida mostram **Sacar**; as falhas mostram **Pedir reembolso**.

## Deploy na testnet Sepolia

1. Crie `.env` a partir do modelo e preencha (use uma carteira **só de testes**):
   ```bash
   cp .env.example .env
   ```
   - `SEPOLIA_RPC_URL`: endpoint da [Infura](https://infura.io) / [Alchemy](https://alchemy.com)
   - `PRIVATE_KEY`: chave da carteira de deploy (sem `0x`)
   - `ETHERSCAN_API_KEY`: para verificar o contrato (opcional)
   - `FEE_BPS`: taxa em basis points (padrão `250` = 2,5%)
2. Obtenha ETH de teste em um *faucet* da Sepolia.
3. Implante:
   ```bash
   npm run deploy:sepolia
   ```
   O script salva `deployments/sepolia.json`, atualiza o frontend e, havendo `ETHERSCAN_API_KEY`, verifica o código no Etherscan.
4. Rode o frontend apontando para a Sepolia:
   ```bash
   VITE_DEFAULT_CHAIN_ID=11155111 npm run frontend:dev
   ```

### Publicando o frontend (Vercel, Netlify, GitHub Pages…)

```bash
npm run frontend:build        # gera frontend/dist
```

Configure as variáveis `VITE_DEFAULT_CHAIN_ID=11155111` (e, se quiser, `VITE_CONTRACT_ADDRESS`, `VITE_SEPOLIA_RPC_URL`) no provedor de hospedagem. Veja `frontend/.env.example`.

## Referência do contrato

### Funções de usuários

| Função | Quem | Descrição |
|---|---|---|
| `createCampaign(title, description, imageUrl, goal, durationInSeconds)` | qualquer um | Cria campanha. `goal` em wei; duração de 1 a 90 dias. |
| `contribute(id)` `payable` | qualquer um | Contribui com ETH enquanto a campanha está ativa. |
| `withdraw(id)` | criador | Saca os fundos (menos a taxa) se a meta foi atingida e o prazo acabou. |
| `refund(id)` | apoiador | Recupera a contribuição de campanha falha ou cancelada. |
| `cancelCampaign(id)` | criador | Cancela campanha ativa; libera reembolsos. |

### Leitura

| Função | Retorno |
|---|---|
| `getCampaign(id)` | `CampaignView` (dados + status calculado) |
| `getCampaigns(offset, limit)` | `(CampaignView[] page, uint256 total)` |
| `getStatus(id)` | `0` Active · `1` Successful · `2` Failed · `3` Cancelled · `4` Completed |
| `contributions(id, address)` | valor contribuído (wei) |
| `campaignCount()`, `feeBps()`, `accruedFees()`, `paused()`, `owner()` | estado global |

### Administração (`owner`)

`setFeeBps(newFee)` · `withdrawFees(to)` · `pause()` · `unpause()` · `transferOwnership()` + `acceptOwnership()`

### Eventos

`CampaignCreated` · `Contributed` · `Withdrawn(id, creator, amount, fee)` · `Refunded` · `CampaignCancelled` · `FeeUpdated` · `FeesWithdrawn`

### Usando pelo console

```bash
npx hardhat console --network localhost
```
```js
const cf = await ethers.getContractAt("Crowdfunding", "ENDERECO_DO_DEPLOY");
await cf.createCampaign("Meu app", "Descrição", "", ethers.parseEther("5"), 30 * 24 * 3600);
await cf.contribute(1, { value: ethers.parseEther("1") });
console.log(await cf.getCampaign(1));
```

## Qualidade

```bash
npm test               # 46 testes do contrato
npm run test:gas       # relatório de gás
npm run coverage       # cobertura
npm run lint:sol       # solhint
npm run frontend:test  # 13 testes (Vitest)
```

Os testes cobrem: criação e validações, contribuições, saque com taxa, taxa congelada, reembolso, cancelamento, todos os estados, paginação, administração, pausa, propriedade em duas etapas, **ataque de reentrância**, falha de transferência e a **invariante de saldo**.

Veja [docs/SEGURANCA.md](docs/SEGURANCA.md) e [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## 🛠 Solução de problemas

| Sintoma | Causa provável / solução |
|---|---|
| "Contrato não implantado" no app | Rode `npm run deploy:local` com o `npm run node` aberto. |
| "Não foi possível ler o contrato" | O nó local não está rodando ou você está na rede errada. |
| Transação falha com *nonce* estranho na MetaMask | Após reiniciar o nó local: *Configurações → Avançado → Limpar dados da aba de atividade*. |
| `HH502` ao compilar | Sem acesso à internet para baixar o compilador Solidity (`binaries.soliditylang.org`). |
| Campanha "Ativa" mas prazo já passou (local) | O relógio da rede local é o do último bloco; faça qualquer transação ou `npm run time-travel`. |


Veja [CONTRIBUTING.md](CONTRIBUTING.md) e [SECURITY.md](SECURITY.md). Licença [MIT](LICENSE).
