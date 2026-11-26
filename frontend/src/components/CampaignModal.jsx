import { useCallback, useEffect, useState } from "react";
import { parseEther } from "ethers";
import { friendlyError } from "../lib/errors";
import {
  formatDate,
  formatEth,
  progressPercent,
  sameAddress,
  shortAddress,
  Status,
  timeLeft,
} from "../lib/format";
import Cover from "./Cover";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";

export default function CampaignModal({ campaign: c, now, ctx, onClose }) {
  const { account, canTransact, connect, send, getContribution, notify, paused } = ctx;
  const [mine, setMine] = useState(0n);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const isCreator = sameAddress(c.creator, account);
  const pct = progressPercent(c.totalRaised, c.goal);
  const fee = (c.totalRaised * BigInt(c.feeBps)) / 10_000n;

  const loadMine = useCallback(async () => {
    if (account) setMine(await getContribution(c.id, account));
    else setMine(0n);
  }, [account, c.id, getContribution]);

  useEffect(() => {
    loadMine().catch(console.error);
  }, [loadMine, c.totalRaised, c.status]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(label, method, args, overrides) {
    setBusy(true);
    notify("info", "Confirme a transação na sua carteira…");
    try {
      await send(method, args, overrides);
      notify("success", label);
      setAmount("");
      await loadMine();
    } catch (e) {
      notify("error", friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function contribute() {
    let value;
    try {
      value = parseEther(amount || "0");
    } catch {
      return notify("error", "Valor inválido.");
    }
    if (value <= 0n) return notify("error", "Informe um valor maior que zero.");
    run("Contribuição enviada! Obrigado por apoiar. 💜", "contribute", [c.id], { value });
  }

  const canContribute = c.status === Status.ACTIVE && !paused;
  const canWithdraw = isCreator && c.status === Status.SUCCESSFUL;
  const canRefund = (c.status === Status.FAILED || c.status === Status.CANCELLED) && mine > 0n;
  const canCancel = isCreator && c.status === Status.ACTIVE;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <Cover id={c.id} imageUrl={c.imageUrl} className="cover-modal" />
        <div className="modal-body">
          <div className="card-top">
            <StatusBadge status={c.status} />
            <span className="muted small">Campanha #{c.id}</span>
          </div>
          <h2>{c.title}</h2>
          <p className="description">{c.description || "Sem descrição."}</p>

          <ProgressBar percent={pct} />
          <div className="card-stats">
            <div>
              <strong className="big">{formatEth(c.totalRaised)} ETH</strong>
              <span className="muted"> de {formatEth(c.goal)} ETH ({pct.toFixed(1)}%)</span>
            </div>
            <div className="right muted">
              {c.status === Status.ACTIVE ? `Termina em ${timeLeft(c.deadline, now)}` : "Encerrada"}
            </div>
          </div>

          <dl className="info">
            <dt>Criador</dt>
            <dd title={c.creator}>
              {shortAddress(c.creator)} {isCreator && <em>(você)</em>}
            </dd>
            <dt>Prazo final</dt>
            <dd>{formatDate(c.deadline)}</dd>
            <dt>Taxa da plataforma</dt>
            <dd>{c.feeBps / 100}% (aplicada apenas no saque)</dd>
            {account && (
              <>
                <dt>Sua contribuição</dt>
                <dd>{formatEth(mine)} ETH</dd>
              </>
            )}
          </dl>

          {!account ? (
            <button className="btn btn-primary btn-block" onClick={connect}>
              Conectar carteira para participar
            </button>
          ) : !canTransact ? (
            <p className="notice notice-warn">Troque para a rede correta no topo da página para interagir.</p>
          ) : (
            <div className="actions">
              {c.status === Status.ACTIVE && paused && (
                <p className="notice notice-warn">O contrato está pausado: contribuições temporariamente bloqueadas.</p>
              )}
              {canContribute && (
                <div className="row">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Valor em ETH"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                  />
                  <button className="btn btn-primary" onClick={contribute} disabled={busy}>
                    Contribuir
                  </button>
                </div>
              )}
              {canWithdraw && (
                <button
                  className="btn btn-success btn-block"
                  disabled={busy}
                  onClick={() => run("Fundos sacados com sucesso! 🎉", "withdraw", [c.id])}
                >
                  Sacar {formatEth(c.totalRaised - fee)} ETH
                </button>
              )}
              {canRefund && (
                <button
                  className="btn btn-warn btn-block"
                  disabled={busy}
                  onClick={() => run("Reembolso recebido.", "refund", [c.id])}
                >
                  Pedir reembolso de {formatEth(mine)} ETH
                </button>
              )}
              {canCancel && (
                <button
                  className="btn btn-danger btn-block"
                  disabled={busy}
                  onClick={() =>
                    window.confirm("Cancelar a campanha? Todos os apoiadores poderão pedir reembolso.") &&
                    run("Campanha cancelada.", "cancelCampaign", [c.id])
                  }
                >
                  Cancelar campanha
                </button>
              )}
              {c.status === Status.SUCCESSFUL && !isCreator && (
                <p className="notice">Meta atingida! O criador já pode sacar os fundos.</p>
              )}
              {c.status === Status.COMPLETED && <p className="notice">Campanha concluída: fundos entregues ao criador.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
