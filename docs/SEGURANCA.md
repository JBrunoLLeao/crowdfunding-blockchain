# Segurança

> ⚠️ Projeto educacional, **não auditado**. Faça auditoria profissional antes de usar com valores reais.

## Proteções implementadas

| Risco | Mitigação |
|---|---|
| Reentrância | `ReentrancyGuard` (`withdraw`, `refund`, `withdrawFees`) + Checks-Effects-Interactions. Há um teste com contrato atacante (`mocks/ReentrancyAttacker.sol`). |
| Overflow/underflow | Solidity 0.8.x (checagem nativa). |
| Fundos presos por falha de transferência | Padrão *pull*: se o criador for um contrato que rejeita ETH, só ele é afetado (`TransferFailed`); os demais fluxos seguem normais. |
| Admin malicioso | Teto de 5% na taxa, taxa congelada por campanha, pausa que **não** bloqueia saques/reembolsos, `Ownable2Step`. O owner **não** tem acesso aos fundos das campanhas, apenas às taxas acumuladas. |
| Envio acidental de ETH | O contrato não tem `receive`/`fallback`: transferências diretas revertem. |
| Dados gigantes (custo/DoS de leitura) | Limites de 100 / 2000 / 300 bytes para título / descrição / URL de imagem. |
| Conteúdo malicioso no frontend | React escapa textos; URLs de imagem só aceitam `http(s)`/`ipfs` (`safeImageUrl`), com `referrerPolicy="no-referrer"`. |

## Invariante testada

`saldo do contrato == fundos ainda não sacados das campanhas + accruedFees`

## Limitações conhecidas

- **Timestamp de bloco**: o prazo usa `block.timestamp`, manipulável em poucos segundos por validadores. Irrelevante para prazos de dias.
- **Criador pode cancelar** mesmo após atingir a meta (antes do prazo). Os apoiadores são reembolsados, mas a decisão é do criador.
- **Sem verificação de identidade/entrega**: o contrato garante o fluxo do dinheiro, não que o criador entregará o prometido. Considere milestones (ver roadmap).
- **Apenas ETH**: sem suporte a ERC-20.
- **Contratos não são upgradeáveis**: correções exigem novo deploy.

## Ferramentas sugeridas

```bash
pip install slither-analyzer
slither .                     # análise estática
npm run coverage              # cobertura de testes
npm run test:gas              # relatório de gás
```

Reporte vulnerabilidades conforme [SECURITY.md](../SECURITY.md).
