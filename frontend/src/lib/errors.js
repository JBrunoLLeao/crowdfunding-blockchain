/** Tradução dos erros customizados do contrato (e do OpenZeppelin) para mensagens amigáveis. */
const MESSAGES = {
  CampaignNotFound: "Campanha não encontrada.",
  InvalidGoal: "A meta deve ser maior que zero.",
  InvalidDuration: "A duração deve estar entre 1 e 90 dias.",
  EmptyTitle: "Informe um título.",
  TitleTooLong: "O título passa de 100 caracteres.",
  DescriptionTooLong: "A descrição passa de 2000 caracteres.",
  ImageUrlTooLong: "A URL da imagem passa de 300 caracteres.",
  CampaignEnded: "O prazo desta campanha já terminou.",
  CampaignStillActive: "A campanha ainda está em andamento.",
  CampaignIsCancelled: "Esta campanha foi cancelada.",
  ZeroContribution: "Informe um valor maior que zero.",
  NotCreator: "Apenas o criador da campanha pode fazer isso.",
  GoalNotReached: "A meta não foi atingida.",
  GoalReached: "A meta foi atingida, não há reembolso.",
  AlreadyWithdrawn: "Os fundos já foram sacados.",
  NothingToRefund: "Você não tem contribuição a reembolsar.",
  FeeTooHigh: "A taxa máxima permitida é 5%.",
  NoFeesToWithdraw: "Não há taxas acumuladas para sacar.",
  InvalidAddress: "Endereço inválido.",
  TransferFailed: "A transferência de ETH falhou.",
  EnforcedPause: "O contrato está pausado: novas campanhas e contribuições estão bloqueadas.",
  OwnableUnauthorizedAccount: "Apenas o administrador do contrato pode fazer isso.",
};

export function friendlyError(err) {
  if (!err) return "Erro desconhecido.";
  if (err.code === "ACTION_REJECTED" || err.code === 4001 || err.info?.error?.code === 4001) {
    return "Transação cancelada na carteira.";
  }
  const name = err.revert?.name || err.errorName;
  if (name && MESSAGES[name]) return MESSAGES[name];
  if (err.code === "INSUFFICIENT_FUNDS") return "Saldo insuficiente para o valor + taxa de gás.";
  return err.shortMessage || err.reason || err.message || "Erro desconhecido.";
}

export { MESSAGES };
