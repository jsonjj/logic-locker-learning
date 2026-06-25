import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { subscribeToAuth } from '../firebase/auth'
import { getUserProfile } from '../firebase/progress'
import { isFirebaseConfigured } from '../firebase/firebaseConfig'
import type { UserProfile } from '../types'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  setProfile: (profile: UserProfile) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfileState] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const p = await getUserProfile(uid)
      setProfileState(p)
    } catch {
      setProfileState(null)
    }
  }, [])

  useEffect(() => {
    // Without Firebase keys there is nothing to subscribe to; render the
    // signed-out state so the app (and the README setup note) still loads.
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    const unsubscribe = subscribeToAuth(async (nextUser) => {
      setUser(nextUser)
      if (nextUser) {
        await loadProfile(nextUser.uid)
      } else {
        setProfileState(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.uid)
  }, [user, loadProfile])

  const setProfile = useCallback((p: UserProfile) => setProfileState(p), [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, setProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
