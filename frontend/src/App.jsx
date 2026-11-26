import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPanel from "./components/AdminPanel.jsx";
import CampaignCard from "./components/CampaignCard.jsx";
import CampaignModal from "./components/CampaignModal.jsx";
import CreateCampaignForm from "./components/CreateCampaignForm.jsx";
import Header from "./components/Header.jsx";
import Toasts from "./components/Toasts.jsx";
import { useCrowdfunding } from "./hooks/useCrowdfunding.js";
import { useWallet } from "./hooks/useWallet.js";
import { CHAINS } from "./lib/config.js";
import { friendlyError } from "./lib/errors.js";
import { formatEth, sameAddress, Status } from "./lib/format.js";

const FILTERS = [
  ["all", "Todas"],
  ["active", "Ativas"],
  ["success", "Meta atingida"],
  ["ended", "Encerradas"],
  ["mine", "Minhas"],
];

function matchesFilter(c, filter, account) {
  switch (filter) {
    case "active":
      return c.status === Status.ACTIVE;
    case "success":
      return c.status === Status.SUCCESSFUL || c.status === Status.COMPLETED;
    case "ended":
      return c.status === Status.FAILED || c.status === Status.CANCELLED;
    case "mine":
      return sameAddress(c.creator, account);
    default:
      return true;
  }
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (type, text) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, type, text }]);
      setTimeout(() => dismiss(id), 6000);
    },
    [dismiss]
  );
  return { toasts, notify, dismiss };
}

export default function App() {
  const wallet = useWallet();
  const cf = useCrowdfunding({ chainId: wallet.chainId, signer: wallet.signer });
  const { toasts, notify, dismiss } = useToasts();

  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [, setTick] = useState(0);

  // Re-renderiza a cada 30s para atualizar as contagens regressivas
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Hora da blockchain estimada (importante na rede local, onde o relógio pode ser adiantado)
  const now = cf.chainNow
    ? cf.chainNow + Math.floor((Date.now() - cf.fetchedAt) / 1000)
    : Math.floor(Date.now() / 1000);

  const wrongNetwork = Boolean(wallet.account) && wallet.chainId !== cf.activeChainId;
  const canTransact = Boolean(wallet.account) && !wrongNetwork && Boolean(cf.address);
  const isOwner = Boolean(cf.meta) && sameAddress(cf.meta.owner, wallet.account);

  const connect = useCallback(async () => {
    try {
      await wallet.connect();
    } catch (e) {
      notify("error", friendlyError(e));
    }
  }, [wallet, notify]);

  const switchChain = useCallback(
    async (id) => {
      try {
        await wallet.switchChain(id);
      } catch (e) {
        notify("error", friendlyError(e));
      }
    },
    [wallet, notify]
  );

  const ctx = useMemo(
    () => ({
      account: wallet.account,
      canTransact,
      connect,
      send: cf.send,
      getContribution: cf.getContribution,
      notify,
      paused: cf.meta?.paused ?? false,
    }),
    [wallet.account, canTransact, connect, cf.send, cf.getContribution, notify, cf.meta]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cf.campaigns.filter((c) => matchesFilter(c, filter, wallet.account) && (!q || c.title.toLowerCase().includes(q)));
  }, [cf.campaigns, filter, query, wallet.account]);

  const stats = useMemo(() => {
    const raised = cf.campaigns.reduce((sum, c) => sum + c.totalRaised, 0n);
    return {
      total: cf.campaigns.length,
      active: cf.campaigns.filter((c) => c.status === Status.ACTIVE).length,
      raised,
    };
  }, [cf.campaigns]);

  const selected = cf.campaigns.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Header
        view={view}
        setView={setView}
        isOwner={isOwner}
        wallet={wallet}
        wrongNetwork={wrongNetwork}
        activeChainId={cf.activeChainId}
        onConnect={connect}
        onSwitch={switchChain}
      />

      <main className="container">
        {!wallet.hasWallet && (
          <p className="notice notice-warn">
            Nenhuma carteira detectada. Você pode navegar pelas campanhas, mas precisa da{" "}
            <a href="https://metamask.io" target="_blank" rel="noreferrer">
              MetaMask
            </a>{" "}
            para criar campanhas ou contribuir.
          </p>
        )}
        {wallet.account && wallet.chainId !== null && !CHAINS[wallet.chainId] && (
          <p className="notice notice-warn">
            Rede não suportada. Use {Object.values(CHAINS).map((c) => c.name).join(" ou ")}.
          </p>
        )}
        {!cf.address && !cf.loading && (
          <p className="notice notice-warn">
            Contrato não implantado em {CHAINS[cf.activeChainId].name}. Rode <code>npm run deploy:local</code> (ou{" "}
            <code>deploy:sepolia</code>) na raiz do projeto.
          </p>
        )}
        {cf.error && (
          <p className="notice notice-error">
            {cf.error}{" "}
            <button className="link" onClick={() => cf.refresh()}>
              Tentar novamente
            </button>
          </p>
        )}
        {cf.meta?.paused && (
          <p className="notice notice-warn">⏸ O contrato está pausado: novas campanhas e contribuições estão bloqueadas.</p>
        )}

        {view === "list" && (
          <>
            <section className="hero">
              <h1>
                Financie ideias, <span className="grad">sem intermediários</span>.
              </h1>
              <p className="muted">
                Crowdfunding “tudo ou nada” na Ethereum: se a meta não for atingida, o dinheiro volta para quem apoiou.
              </p>
              <div className="stats-row">
                <div className="stat">
                  <strong>{stats.total}</strong>
                  <span className="muted small">campanhas</span>
                </div>
                <div className="stat">
                  <strong>{stats.active}</strong>
                  <span className="muted small">ativas</span>
                </div>
                <div className="stat">
                  <strong>{formatEth(stats.raised)} ETH</strong>
                  <span className="muted small">arrecadados</span>
                </div>
              </div>
            </section>

            <div className="toolbar">
              <div className="tabs">
                {FILTERS.map(([key, label]) => (
                  <button key={key} className={`tab${filter === key ? " active" : ""}`} onClick={() => setFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
              <input
                className="input search"
                placeholder="Buscar por título…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {cf.loading && cf.campaigns.length === 0 ? (
              <p className="muted center">Carregando campanhas…</p>
            ) : visible.length === 0 ? (
              <div className="empty">
                <p>Nenhuma campanha encontrada.</p>
                <button className="btn btn-primary" onClick={() => setView("create")}>
                  Criar a primeira campanha
                </button>
              </div>
            ) : (
              <div className="grid">
                {visible.map((c) => (
                  <CampaignCard key={c.id} campaign={c} now={now} onOpen={setSelectedId} />
                ))}
              </div>
            )}
          </>
        )}

        {view === "create" && (
          <CreateCampaignForm ctx={ctx} feeBps={cf.meta?.feeBps} onCreated={() => setView("list")} />
        )}

        {view === "admin" && isOwner && cf.meta && <AdminPanel key={cf.meta.feeBps} meta={cf.meta} ctx={ctx} />}
      </main>

      {selected && <CampaignModal campaign={selected} now={now} ctx={ctx} onClose={() => setSelectedId(null)} />}

      <Toasts toasts={toasts} onDismiss={dismiss} />

      <footer className="footer">
        Projeto educacional, não auditado. Use apenas redes de teste. Contrato:{" "}
        <code>{cf.address ?? "não implantado"}</code>
      </footer>
    </>
  );
}
