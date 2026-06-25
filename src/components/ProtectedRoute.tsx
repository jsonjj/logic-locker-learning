import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Guards authenticated areas of the app.
 * - Unauthenticated users are sent to /auth.
 * - Authenticated users without a completed profile are sent to /profile-setup.
 */
export default function ProtectedRoute({
  children,
  requireProfile = true,
}: {
  children: ReactNode
  requireProfile?: boolean
}) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" aria-label="Loading" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (requireProfile && (!profile || !profile.displayName)) {
    return <Navigate to="/profile-setup" replace />
  }

  return <>{children}</>
}
