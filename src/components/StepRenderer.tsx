import type { Step } from '../types'
import AkashDialog from './AkashDialog'
import ConceptCard from './ConceptCard'
import ChoiceStepView from './steps/ChoiceStepView'
import ClueSortView from './steps/ClueSortView'
import DeductionGridView from './steps/DeductionGridView'
import SingleCellGridView from './steps/SingleCellGridView'
import LogicSwitchesView from './steps/LogicSwitchesView'
import OrderingView from './steps/OrderingView'

export default function StepRenderer({
  step,
  locked,
  onResult,
}: {
  step: Step
  locked: boolean
  onResult: (isCorrect: boolean, submittedValue: unknown) => void
}) {
  switch (step.type) {
    case 'dialogue':
      return <AkashDialog speaker={step.speaker} text={step.text} />

    case 'concept':
      return <ConceptCard step={step} />

    case 'caseSummary':
      return (
        <div className="stack">
          <p>{step.text}</p>
          {step.akashLine && <AkashDialog text={step.akashLine} />}
        </div>
      )

    case 'multipleChoice':
    case 'prediction':
    case 'highlightChoice':
    case 'symbolTap':
      return <ChoiceStepView step={step} locked={locked} onResult={onResult} />

    case 'clueSort':
      return <ClueSortView step={step} locked={locked} onResult={onResult} />

    case 'deductionGrid':
    case 'miniGrid':
      return <DeductionGridView step={step} locked={locked} onResult={onResult} />

    case 'singleCellGrid':
      return <SingleCellGridView step={step} locked={locked} onResult={onResult} />

    case 'logicSwitches':
      return <LogicSwitchesView step={step} locked={locked} onResult={onResult} />

    case 'ordering':
      return <OrderingView step={step} locked={locked} onResult={onResult} />

    default:
      return null
  }
}
