import { formatEth, progressPercent, shortAddress, Status, timeLeft } from "../lib/format";
import Cover from "./Cover";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";

export default function CampaignCard({ campaign: c, now, onOpen }) {
  const pct = progressPercent(c.totalRaised, c.goal);
  return (
    <article
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(c.id)}
    >
      <Cover id={c.id} imageUrl={c.imageUrl} className="cover-card" />
      <div className="card-body">
        <div className="card-top">
          <StatusBadge status={c.status} />
          <span className="muted small">#{c.id}</span>
        </div>
        <h3 className="card-title">{c.title}</h3>
        <p className="muted small">por {shortAddress(c.creator)}</p>
        <ProgressBar percent={pct} />
        <div className="card-stats">
          <div>
            <strong>{formatEth(c.totalRaised)} ETH</strong>
            <span className="muted small"> de {formatEth(c.goal)} ETH</span>
          </div>
          <div className="right">
            <strong>{pct.toFixed(0)}%</strong>
            <div className="muted small">{c.status === Status.ACTIVE ? timeLeft(c.deadline, now) : "Encerrada"}</div>
          </div>
        </div>
      </div>
    </article>
  );
}
