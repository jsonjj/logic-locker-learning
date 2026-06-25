import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logOut } from '../../firebase/auth'
import { R3D } from '../contracts'
import { useInventory } from '../state/InventoryContext'
import { LEARNING_MODES } from '../skills'
import {
  useQuality,
  setQualityTier,
  setQualityAuto,
  type QualityTier,
} from '../engine/quality'
import '../../styles/hud3d.css'

const QUALITY_TIERS: { id: QualityTier; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'med', label: 'Med' },
  { id: 'high', label: 'High' },
]

export interface GameMenuProps {
  open: boolean
  onClose: () => void
  /** Optional "restart this room" action when in a sector. */
  onRestart?: () => void
}

/**
 * The pause overlay. Restores the logout control the old hallway had, plus
 * quick nav to the hub, leaderboard, and profile. `GameMenuProps` is stable;
 * logout calls `logOut` then routes to /auth.
 */
export default function GameMenu({ open, onClose, onRestart }: GameMenuProps) {
  const navigate = useNavigate()
  const inv = useInventory()
  const quality = useQuality()

  // Esc resumes — natural for a pause menu.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleLogout() {
    try {
      await logOut()
    } catch {
      /* ignore — still leave the session */
    }
    navigate('/auth', { replace: true })
  }

  return (
    <div
      className="game-menu-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
      onClick={onClose}
    >
      <div className="game-menu-card hud-menu-card" onClick={(e) => e.stopPropagation()}>
        <p className="hud-menu-eyebrow">Lockdown paused</p>
        <h2 className="hud-menu-title">Take a breath</h2>
        <p className="hud-menu-sub">The alarm holds while you regroup.</p>

        <div className="game-menu-actions">
          <button
            type="button"
            className="hud-menu-btn-row is-primary"
            onClick={onClose}
            autoFocus
          >
            <span className="hud-menu-ico" aria-hidden>
              ▶
            </span>
            Resume
          </button>

          {onRestart && (
            <button type="button" className="hud-menu-btn-row" onClick={onRestart}>
              <span className="hud-menu-ico" aria-hidden>
                ↻
              </span>
              Restart room
            </button>
          )}

          <div className="hud-menu-divider" />

          <div className="hud-style-toggle">
            <p className="hud-style-toggle-label">
              Learning style
              <span className="hud-style-toggle-hint">same lessons, your way</span>
            </p>
            <div className="hud-style-seg" role="radiogroup" aria-label="Learning style">
              {LEARNING_MODES.map((m) => {
                const active = inv.mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`hud-style-seg-btn${active ? ' is-active' : ''}`}
                    onClick={() => inv.setMode(m.id)}
                    title={m.description}
                  >
                    <span className="hud-style-seg-glyph" aria-hidden>{m.glyph}</span>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hud-menu-divider" />

          <div className="hud-style-toggle">
            <p className="hud-style-toggle-label">
              Graphics quality
              <button
                type="button"
                className={`hud-quality-auto${quality.auto ? ' is-on' : ''}`}
                role="switch"
                aria-checked={quality.auto}
                onClick={() => setQualityAuto(!quality.auto)}
                title="Auto-adjust quality to keep the frame rate smooth"
              >
                <span className="hud-quality-auto-track" aria-hidden>
                  <span className="hud-quality-auto-thumb" />
                </span>
                Auto
              </button>
            </p>
            <div className="hud-style-seg" role="radiogroup" aria-label="Graphics quality">
              {QUALITY_TIERS.map((t) => {
                const active = quality.tier === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`hud-style-seg-btn hud-quality-seg-btn${active ? ' is-active' : ''}`}
                    onClick={() => setQualityTier(t.id)}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <p className="hud-quality-status">
              {quality.auto ? 'Auto' : 'Manual'} · currently{' '}
              <strong>{quality.tier.toUpperCase()}</strong>
            </p>
          </div>

          <div className="hud-menu-divider" />

          <div className="hud-menu-grid">
            <button
              type="button"
              className="hud-menu-btn-row"
              onClick={() => navigate(R3D.world)}
            >
              <span className="hud-menu-ico" aria-hidden>
                ⌂
              </span>
              The Yard
            </button>
            <button
              type="button"
              className="hud-menu-btn-row"
              onClick={() => navigate(R3D.leaderboard)}
            >
              <span className="hud-menu-ico" aria-hidden>
                🏆
              </span>
              Leaderboard
            </button>
          </div>

          <div className="hud-menu-divider" />

          <button type="button" className="hud-menu-btn-row is-danger" onClick={handleLogout}>
            <span className="hud-menu-ico" aria-hidden>
              ⏻
            </span>
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
