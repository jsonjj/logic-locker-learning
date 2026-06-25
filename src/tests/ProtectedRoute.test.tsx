import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'

// Controllable mock of the auth context.
const authState: { user: unknown; profile: unknown; loading: boolean } = {
  user: null,
  profile: null,
  loading: false,
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Secret Hallway</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>Auth Screen</div>} />
        <Route path="/profile-setup" element={<div>Profile Setup</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.user = null
    authState.profile = null
    authState.loading = false
  })

  it('redirects unauthenticated users to /auth', () => {
    renderAt('/protected')
    expect(screen.getByText('Auth Screen')).toBeInTheDocument()
    expect(screen.queryByText('Secret Hallway')).not.toBeInTheDocument()
  })

  it('redirects authenticated users without a profile to /profile-setup', () => {
    authState.user = { uid: 'abc' }
    authState.profile = null
    renderAt('/protected')
    expect(screen.getByText('Profile Setup')).toBeInTheDocument()
  })

  it('renders children for authenticated users with a profile', () => {
    authState.user = { uid: 'abc' }
    authState.profile = { displayName: 'Jayden' }
    renderAt('/protected')
    expect(screen.getByText('Secret Hallway')).toBeInTheDocument()
  })
})
