import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom'
import { effectsAllowed, useQuality } from './game3d/engine/quality'
import './styles/animations.css'
import ProtectedRoute from './components/ProtectedRoute'
import GlobalLogout from './components/GlobalLogout'
import GlobalHome from './components/GlobalHome'
import SoundControl from './components/SoundControl'
import { RunProvider } from './game3d/state/RunContext'
import { InventoryProvider } from './game3d/state/InventoryContext'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import ProfileSetupPage from './pages/ProfileSetupPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ModeSelectPage from './pages/ModeSelectPage'
import MultiplayerLobbyPage from './pages/MultiplayerLobbyPage'
import {
  R3D,
  ROOM_ROUTE_PATTERN,
  CLASSROOM_ROUTE_PATTERN,
  type ReviewDeck,
  type SectorId,
} from './game3d/contracts'
import { earlierSkills } from './game3d/skills'
import { markSkillsReviewed } from './firebase/reviewSchedule'

// The 3D pages pull in three.js + Rapier (a large bundle), so they are
// code-split and only loaded when the player actually enters the 3D world.
const WorldPage = lazy(() => import('./pages/WorldPage'))
const SectorRoomPage = lazy(() => import('./pages/SectorRoomPage'))
const BossRoomPage = lazy(() => import('./pages/BossRoomPage'))
const FinalePage = lazy(() => import('./pages/FinalePage'))
const MultiplayerArenaPage = lazy(() => import('./pages/MultiplayerArenaPage'))
const Classroom = lazy(() => import('./game3d/review/Classroom'))

function World3DFallback() {
  return <div className="world-loading">Entering the compound…</div>
}

/**
 * The spaced "Skills Audit" classroom (Mastery Loop). Reuses the 3D Classroom
 * wired to an audit deck of EARLIER skills. The heavy deck/lesson data is pulled
 * in via a dynamic import so it stays out of the initial bundle; completing the
 * audit records the reviewed skills against the spaced-repetition schedule.
 */
function ClassroomAuditRoute() {
  const { sectorId = 'lesson-7' } = useParams()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<ReviewDeck | null>(null)

  useEffect(() => {
    let alive = true
    void import('./game3d/review/decks').then((m) => {
      if (alive) setDeck(m.getAuditDeck(sectorId as SectorId))
    })
    return () => {
      alive = false
    }
  }, [sectorId])

  if (!deck) return <World3DFallback />

  return (
    <Suspense fallback={<World3DFallback />}>
      <Classroom
        deck={deck}
        onExit={() => {
          markSkillsReviewed(earlierSkills(sectorId as SectorId))
          navigate(R3D.world)
        }}
      />
    </Suspense>
  )
}

export default function App() {
  const location = useLocation()
  useQuality()
  // Lightweight fade/slide between pages; snapped under reduced-motion / low tier.
  const transition = effectsAllowed()
  return (
    <RunProvider>
      <InventoryProvider>
        <GlobalLogout />
        <GlobalHome />
        <SoundControl />
        <div
          key={location.pathname}
          className={transition ? 'route-anim' : undefined}
        >
        <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/profile-setup"
          element={
            <ProtectedRoute requireProfile={false}>
              <ProfileSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play"
          element={
            <ProtectedRoute>
              <ModeSelectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mp"
          element={
            <ProtectedRoute>
              <MultiplayerLobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mp/:code"
          element={
            <ProtectedRoute>
              <MultiplayerLobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mp/:code/play"
          element={
            <ProtectedRoute>
              <Suspense fallback={<World3DFallback />}>
                <MultiplayerArenaPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/world"
          element={
            <ProtectedRoute>
              <Suspense fallback={<World3DFallback />}>
                <WorldPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROOM_ROUTE_PATTERN}
          element={
            <ProtectedRoute>
              <Suspense fallback={<World3DFallback />}>
                <SectorRoomPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path={CLASSROOM_ROUTE_PATTERN}
          element={
            <ProtectedRoute>
              <ClassroomAuditRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boss"
          element={
            <ProtectedRoute>
              <Suspense fallback={<World3DFallback />}>
                <BossRoomPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/finale"
          element={
            <ProtectedRoute>
              <Suspense fallback={<World3DFallback />}>
                <FinalePage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </InventoryProvider>
    </RunProvider>
  )
}
