import { useState } from "react";
import { isAddress } from "ethers";
import { friendlyError } from "../lib/errors";
import { formatEth } from "../lib/format";

export default function AdminPanel({ meta, ctx }) {
  const { account, canTransact, send, notify } = ctx;
  const [fee, setFee] = useState(String(meta.feeBps / 100));
  const [to, setTo] = useState(account ?? "");
  const [busy, setBusy] = useState(false);

  async function run(label, method, args = []) {
    setBusy(true);
    notify("info", "Confirme a transação na sua carteira…");
    try {
      await send(method, args);
      notify("success", label);
    } catch (e) {
      notify("error", friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function saveFee() {
    const pct = Number(fee);
    if (!Number.isFinite(pct) || pct < 0 || pct > 5) return notify("error", "A taxa deve estar entre 0% e 5%.");
    run("Taxa atualizada (vale para novas campanhas).", "setFeeBps", [Math.round(pct * 100)]);
  }

  function claimFees() {
    if (!isAddress(to)) return notify("error", "Endereço de destino inválido.");
    run("Taxas sacadas.", "withdrawFees", [to]);
  }

  const disabled = busy || !canTransact;

  return (
    <div className="panel">
      <h2>Painel do administrador</h2>
      <div className="stats-row">
        <div className="stat">
          <span className="muted small">Taxa atual</span>
          <strong>{meta.feeBps / 100}%</strong>
        </div>
        <div className="stat">
          <span className="muted small">Taxas acumuladas</span>
          <strong>{formatEth(meta.accruedFees)} ETH</strong>
        </div>
        <div className="stat">
          <span className="muted small">Estado</span>
          <strong>{meta.paused ? "⏸ Pausado" : "▶ Operando"}</strong>
        </div>
      </div>

      <h3>Taxa da plataforma</h3>
      <div className="row">
        <input className="input" type="number" min="0" max="5" step="0.1" value={fee} onChange={(e) => setFee(e.target.value)} />
        <button className="btn" disabled={disabled} onClick={saveFee}>
          Salvar (%)
        </button>
      </div>

      <h3>Sacar taxas</h3>
      <div className="row">
        <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… destino" />
        <button className="btn btn-success" disabled={disabled || meta.accruedFees === 0n} onClick={claimFees}>
          Sacar
        </button>
      </div>

      <h3>Pausa de emergência</h3>
      <p className="muted small">
        Pausar bloqueia novas campanhas e contribuições. Saques e reembolsos continuam sempre disponíveis.
      </p>
      {meta.paused ? (
        <button className="btn btn-primary" disabled={disabled} onClick={() => run("Contrato retomado.", "unpause")}>
          Retomar operação
        </button>
      ) : (
        <button className="btn btn-danger" disabled={disabled} onClick={() => run("Contrato pausado.", "pause")}>
          Pausar contrato
        </button>
      )}
    </div>
  );
}
