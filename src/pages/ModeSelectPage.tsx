import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isRealtimeConfigured } from '../firebase/firebaseConfig'
import { useInventory } from '../game3d/state/InventoryContext'
import { LEARNING_MODES } from '../game3d/skills'
import '../styles/multiplayer.css'
import '../styles/learn.css'

/**
 * The post-login menu: choose how you want to LEARN (visual / narrative /
 * hands-on — all teach the same skills, same questions, just presented
 * differently), then drop into the single-player campaign or a live arena.
 */
export default function ModeSelectPage() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const inv = useInventory()

  if (!loading && !user) return <Navigate to="/" replace />
  if (!loading && user && !profile?.displayName) return <Navigate to="/profile-setup" replace />

  return (
    <div className="mode-select">
      <div className="mode-select-head">
        <span className="mode-eyebrow">Logic Locker: Breakout</span>
        <h1 className="mode-title">Choose your run</h1>
        <p className="mode-sub">Break out solo, or drop into a live arena with friends.</p>
      </div>

      <div className="ll-style-picker">
        <div className="ll-style-picker-head">
          <h2 className="ll-style-title">Pick how you learn</h2>
          <p className="ll-style-sub">
            All three teach the <strong>same skills</strong> with the <strong>same questions</strong>
            {' '}— only the presentation changes. Switch any time from the pause menu.
          </p>
        </div>
        <div className="ll-style-cards" role="radiogroup" aria-label="Learning style">
          {LEARNING_MODES.map((m) => {
            const active = inv.mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`ll-style-card${active ? ' is-active' : ''}`}
                onClick={() => inv.setMode(m.id)}
              >
                <span className="ll-style-glyph" aria-hidden>{m.glyph}</span>
                <span className="ll-style-name">{m.label}</span>
                <span className="ll-style-tagline">{m.tagline}</span>
                <span className="ll-style-desc">{m.description}</span>
                {active && <span className="ll-style-check" aria-hidden>✓ Selected</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mode-cards">
        <button type="button" className="mode-card" onClick={() => navigate('/world')}>
          <span className="mode-card-icon" aria-hidden>🚪</span>
          <span className="mode-card-name">Single Player</span>
          <span className="mode-card-desc">
            The prison-break campaign — learn, fight, and free Akash room by room. Clear rooms to
            spin the wheel and unlock weapons &amp; upgrades.
          </span>
          <span className="mode-card-cta">Play solo →</span>
        </button>

        <button
          type="button"
          className={`mode-card mode-card--versus${isRealtimeConfigured ? '' : ' is-disabled'}`}
          onClick={() => isRealtimeConfigured && navigate('/mp')}
          disabled={!isRealtimeConfigured}
        >
          <span className="mode-card-icon" aria-hidden>⚔️</span>
          <span className="mode-card-name">Multiplayer</span>
          <span className="mode-card-desc">
            A live arena for 2–6 friends. Share enemies, race for kills, and battle a best-of
            series with a real-time leaderboard.
          </span>
          <span className="mode-card-cta">
            {isRealtimeConfigured ? 'Find a match →' : 'Realtime DB not configured'}
          </span>
        </button>
      </div>

      <p className="mode-note">
        <strong>How it connects:</strong> you learn concepts and unlock weapons &amp; upgrades in
        Single Player — and the gear you earn carries over into Multiplayer, where you can take it
        into the arena against 2–6 friends.
      </p>
    </div>
  )
}
