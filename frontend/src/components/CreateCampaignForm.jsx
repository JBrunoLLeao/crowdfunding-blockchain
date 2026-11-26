import { useState } from "react";
import { parseEther } from "ethers";
import { friendlyError } from "../lib/errors";
import { byteLength, safeImageUrl } from "../lib/format";

const INITIAL = { title: "", description: "", imageUrl: "", goal: "", days: "30" };

export default function CreateCampaignForm({ ctx, feeBps, onCreated }) {
  const { account, canTransact, connect, send, notify, paused } = ctx;
  const [form, setForm] = useState(INITIAL);
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function validate() {
    if (!form.title.trim()) return "Informe um título.";
    if (byteLength(form.title) > 100) return "O título deve ter no máximo 100 bytes.";
    if (byteLength(form.description) > 2000) return "A descrição deve ter no máximo 2000 bytes.";
    if (form.imageUrl) {
      if (byteLength(form.imageUrl) > 300) return "A URL da imagem deve ter no máximo 300 bytes.";
      if (!safeImageUrl(form.imageUrl)) return "A URL da imagem deve começar com https:// ou ipfs://.";
    }
    try {
      if (parseEther(form.goal || "0") <= 0n) return "A meta deve ser maior que zero.";
    } catch {
      return "Meta inválida.";
    }
    const days = Number(form.days);
    if (!Number.isInteger(days) || days < 1 || days > 90) return "A duração deve ser de 1 a 90 dias.";
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) return notify("error", problem);

    setBusy(true);
    notify("info", "Confirme a transação na sua carteira…");
    try {
      await send("createCampaign", [
        form.title.trim(),
        form.description.trim(),
        form.imageUrl.trim(),
        parseEther(form.goal),
        BigInt(form.days) * 86400n,
      ]);
      notify("success", "Campanha criada com sucesso! 🚀");
      setForm(INITIAL);
      onCreated();
    } catch (err) {
      notify("error", friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Criar campanha</h2>
      <p className="muted">
        Modelo tudo ou nada: se a meta não for atingida até o prazo, todos os apoiadores recuperam seu dinheiro.
        {feeBps != null && ` Taxa da plataforma: ${feeBps / 100}% sobre o valor sacado (congelada na criação).`}
      </p>

      <label>
        Título *
        <input className="input" value={form.title} onChange={set("title")} maxLength={100} placeholder="Ex.: Horta comunitária" />
      </label>
      <label>
        Descrição
        <textarea className="input" rows={5} value={form.description} onChange={set("description")} placeholder="Conte sua ideia…" />
      </label>
      <label>
        URL da imagem de capa (opcional)
        <input className="input" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://… ou ipfs://…" />
      </label>
      <div className="row">
        <label className="grow">
          Meta (ETH) *
          <input className="input" type="number" min="0" step="0.01" value={form.goal} onChange={set("goal")} placeholder="5" />
        </label>
        <label className="grow">
          Duração (dias) *
          <input className="input" type="number" min="1" max="90" step="1" value={form.days} onChange={set("days")} />
        </label>
      </div>

      {!account ? (
        <button type="button" className="btn btn-primary btn-block" onClick={connect}>
          Conectar carteira
        </button>
      ) : (
        <button className="btn btn-primary btn-block" disabled={busy || !canTransact || paused}>
          {busy ? "Aguardando…" : paused ? "Contrato pausado" : canTransact ? "Criar campanha" : "Troque de rede"}
        </button>
      )}
    </form>
  );
}
