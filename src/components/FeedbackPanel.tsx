import AkashAvatar from './AkashAvatar'
import { pickQuip } from '../data/akashQuips'

export default function FeedbackPanel({
  status,
  message,
  guidedReasoning,
  showReasoning,
}: {
  status: 'correct' | 'wrong'
  message: string
  guidedReasoning?: string[]
  showReasoning?: boolean
}) {
  const tier = status === 'correct' ? 'correct' : 'secondWrong'
  const quip = pickQuip(tier, message)
  const reasoning = guidedReasoning ?? []

  return (
    <div className={`feedback ${status}`} role="status" aria-live="polite">
      <div className="feedback-head">
        <AkashAvatar className="feedback-akash" size={36} />
        <div>
          <div className="feedback-name">Akash</div>
          <div className="feedback-title">{quip}</div>
        </div>
      </div>
      {message && <p className="feedback-msg">{message}</p>}

      {showReasoning && reasoning.length > 0 && (
        <div className="guided">
          <div className="guided-title">How to think it through</div>
          <ol>
            {reasoning.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
