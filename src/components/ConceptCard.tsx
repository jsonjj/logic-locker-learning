import type { ConceptStep } from '../types'
import AkashDialog from './AkashDialog'

export default function ConceptCard({ step }: { step: ConceptStep }) {
  return (
    <div className="concept stack">
      <div>
        <div className="concept-eyebrow">Case Briefing</div>
        <h3 className="concept-title">{step.title}</h3>
        {step.intro && <p className="concept-intro">{step.intro}</p>}
      </div>

      <ul className="concept-points">
        {step.points.map((point, i) => (
          <li className="concept-point" key={i}>
            <span className="concept-term">{point.term}</span>
            <span className="concept-detail">{point.detail}</span>
            {point.example && <span className="concept-example">{point.example}</span>}
          </li>
        ))}
      </ul>

      {step.akashLine && <AkashDialog text={step.akashLine} />}
    </div>
  )
}
