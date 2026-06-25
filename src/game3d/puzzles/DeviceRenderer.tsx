/**
 * [Agent 3] Renders the correct security device for a given lesson step. Uses the
 * step's discriminant so each device gets a precisely-typed step prop.
 */
import type { SkillId } from '../../types'
import type { LearningMode } from '../skills'
import type { InteractiveStep, DeviceCallbacks } from './types'
import OverrideConsole from './OverrideConsole'
import EvidenceLocker from './EvidenceLocker'
import DeductionTerminal from './DeductionTerminal'
import LogicGatePanel from './LogicGatePanel'
import WiringSequencePanel from './WiringSequencePanel'

interface Props extends DeviceCallbacks {
  step: InteractiveStep
  /** Learning-style mode — devices apply a class + affordance per mode. */
  mode?: LearningMode
  /** The room's core skill, used to name the failed move on a wrong answer. */
  skill?: SkillId
}

export default function DeviceRenderer({ step, onSolved, onMistake, mode, skill }: Props) {
  switch (step.type) {
    case 'multipleChoice':
    case 'prediction':
    case 'highlightChoice':
    case 'symbolTap':
      return <OverrideConsole step={step} onSolved={onSolved} onMistake={onMistake} mode={mode} skill={skill} />
    case 'clueSort':
      return <EvidenceLocker step={step} onSolved={onSolved} onMistake={onMistake} mode={mode} skill={skill} />
    case 'deductionGrid':
    case 'miniGrid':
    case 'singleCellGrid':
      return <DeductionTerminal step={step} onSolved={onSolved} onMistake={onMistake} mode={mode} skill={skill} />
    case 'logicSwitches':
      return <LogicGatePanel step={step} onSolved={onSolved} onMistake={onMistake} mode={mode} skill={skill} />
    case 'ordering':
      return <WiringSequencePanel step={step} onSolved={onSolved} onMistake={onMistake} mode={mode} skill={skill} />
  }
}
