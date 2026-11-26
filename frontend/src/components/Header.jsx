import { CHAINS } from "../lib/config";
import { shortAddress } from "../lib/format";

export default function Header({ view, setView, isOwner, wallet, wrongNetwork, activeChainId, onConnect, onSwitch }) {
  const tabs = [
    ["list", "Campanhas"],
    ["create", "Criar campanha"],
    ...(isOwner ? [["admin", "Admin"]] : []),
  ];
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand" onClick={() => setView("list")}>
          <span className="logo">◆</span> Crowdfunding<span className="brand-accent">Chain</span>
        </div>
        <nav className="nav">
          {tabs.map(([key, label]) => (
            <button key={key} className={`nav-btn${view === key ? " active" : ""}`} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="wallet">
          {wallet.account && (
            <span className={`chain-pill${wrongNetwork ? " chain-bad" : ""}`}>
              {CHAINS[wallet.chainId]?.name ?? `Rede ${wallet.chainId}`}
            </span>
          )}
          {wrongNetwork && (
            <button className="btn btn-small btn-warn" onClick={() => onSwitch(activeChainId)}>
              Trocar rede
            </button>
          )}
          {wallet.account ? (
            <span className="account-pill" title={wallet.account}>
              {shortAddress(wallet.account)}
            </span>
          ) : (
            <button className="btn btn-primary btn-small" onClick={onConnect}>
              Conectar carteira
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
