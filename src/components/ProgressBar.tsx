export default function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <span className="step-counter">
          Step {Math.min(current, total)} of {total}
        </span>
        <span className="step-counter">{pct}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
