import { STATUS_META } from "../lib/format";

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: "?", tone: "done" };
  return <span className={`badge badge-${meta.tone}`}>{meta.label}</span>;
}
