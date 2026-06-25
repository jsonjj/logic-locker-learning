import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from './firebaseConfig'

export function signUp(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export function logIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function logOut() {
  return signOut(auth)
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

/** Turn a Firebase auth error code into a friendly, recruit-facing message. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already enrolled. Try logging in instead.'
    case 'auth/invalid-email':
      return 'That email address does not look right.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password, rookie. Try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    default:
      return 'Something went wrong. Check your connection and try again.'
  }
}
