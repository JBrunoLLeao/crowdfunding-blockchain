export default function ProgressBar({ percent }) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill${percent >= 100 ? " progress-done" : ""}`} style={{ width: `${width}%` }} />
    </div>
  );
}
