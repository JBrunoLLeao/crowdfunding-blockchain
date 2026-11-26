# Changelog

## 2.0.0

### Contrato
- Cancelamento de campanha pelo criador (reembolso imediato para todos).
- Taxa da plataforma configurável (teto de 5%), **congelada por campanha** na criação.
- `Ownable2Step` (transferência de propriedade em duas etapas) e `Pausable`
  (a pausa nunca bloqueia saques nem reembolsos).
- Estados de campanha: `Active`, `Successful`, `Failed`, `Cancelled`, `Completed`.
- Leitura paginada (`getCampaigns`) e `CampaignView` com status calculado.
- Metadados: imagem de capa e limites de tamanho para título/descrição/URL.
- Storage compactado (criador, prazo, taxa e flags em um único slot).

### Projeto
- 46 testes de contrato (incluindo reentrância, TransferFailed e invariante de saldo).
- Frontend React + Vite + ethers v6 com MetaMask, painel de admin e testes (Vitest).
- Scripts de deploy (com verificação no Etherscan), seed, time-travel e export de ABI.
- CI no GitHub Actions, Dependabot, solhint.

## 1.0.0
- Contrato básico de crowdfunding "tudo ou nada" com testes e deploy.
