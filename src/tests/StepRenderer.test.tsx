import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StepRenderer from '../components/StepRenderer'
import { getLesson } from '../data/lessons'
import type { Step } from '../types'

function findStep(lessonId: string, stepId: string): Step {
  const step = getLesson(lessonId)!.steps.find((s) => s.id === stepId)
  if (!step) throw new Error(`Missing step ${stepId}`)
  return step
}

describe('StepRenderer renders the correct UI for each step type', () => {
  it('renders a dialogue step as Akash speech', () => {
    const step = findStep('lesson-1', 'l1-step-1')
    render(<StepRenderer step={step} locked={false} onResult={vi.fn()} />)
    expect(screen.getByText('Akash')).toBeInTheDocument()
  })

  it('renders a multiple-choice step with its choices and a Check button', () => {
    const step = findStep('lesson-1', 'l1-step-6')
    render(<StepRenderer step={step} locked={false} onResult={vi.fn()} />)
    expect(
      screen.getByText('The pass was last seen on the front desk.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument()
  })

  it('renders a deduction grid step with a Check Grid button', () => {
    const step = findStep('lesson-2', 'l2-step-7')
    render(<StepRenderer step={step} locked={false} onResult={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Check Grid' })).toBeInTheDocument()
  })

  it('renders a logic switches step with a door status', () => {
    const step = findStep('lesson-5', 'l5-step-3')
    render(<StepRenderer step={step} locked={false} onResult={vi.fn()} />)
    expect(screen.getByText(/Door:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check Door' })).toBeInTheDocument()
  })

  it('renders an ordering step with a Check Order button', () => {
    const step = findStep('lesson-6', 'l6-step-5')
    render(<StepRenderer step={step} locked={false} onResult={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Check Order' })).toBeInTheDocument()
  })
})
