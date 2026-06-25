export default function RoundFailedOverlay({ onReview }: { onReview: () => void }) {
  return (
    <div className="round-failed-overlay" role="alertdialog" aria-label="Round failed">
      <div className="round-failed-spotlight" />
      <div className="slam-doors" aria-hidden>
        <div className="slam-door left" />
        <div className="slam-door right" />
      </div>
      <div className="round-failed-content">
        <div className="round-failed-title">ROUND FAILED</div>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <p style={{ marginTop: 0 }}>
            "You're not eliminated from learning, rookie. Just from looking smug." — Akash
          </p>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Your progress is safe. Keep going — mistakes only affect your badge, not the case.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={onReview}>
            Review with Akash
          </button>
        </div>
      </div>
    </div>
  )
}
