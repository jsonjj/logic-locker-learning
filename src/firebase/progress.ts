import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebaseConfig'
import type {
  UserProfile,
  LessonProgress,
  StepAnswer,
  BadgeRecord,
  BadgeType,
} from '../types'
import { lessons } from '../data/lessons'

// ---------- User profile ----------

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  avatarId: string,
): Promise<UserProfile> {
  const firstLessonId = lessons[0]?.id ?? 'lesson-1'
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    avatarId,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    currentLessonId: firstLessonId,
    currentStepId: lessons[0]?.steps[0]?.id ?? '',
    unlockedLessonIds: [firstLessonId],
    completedLessonIds: [],
    streakCount: 0,
    lastLessonCompletedDate: '',
  }
  await setDoc(doc(db, 'users', uid), profile)
  return profile
}

export async function updateLastActive(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { lastActiveAt: serverTimestamp() })
}

export async function setCurrentPosition(
  uid: string,
  lessonId: string,
  stepId: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    currentLessonId: lessonId,
    currentStepId: stepId,
    lastActiveAt: serverTimestamp(),
  })
}

// ---------- Lesson progress ----------

function progressRef(uid: string, lessonId: string) {
  return doc(db, 'users', uid, 'progress', lessonId)
}

export async function getLessonProgress(
  uid: string,
  lessonId: string,
): Promise<LessonProgress | null> {
  const snap = await getDoc(progressRef(uid, lessonId))
  return snap.exists() ? (snap.data() as LessonProgress) : null
}

export async function getAllProgress(uid: string): Promise<LessonProgress[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'progress'))
  return snap.docs.map((d) => d.data() as LessonProgress)
}

export async function startLesson(uid: string, lessonId: string): Promise<LessonProgress> {
  const existing = await getLessonProgress(uid, lessonId)
  if (existing) return existing
  const lesson = lessons.find((l) => l.id === lessonId)
  const progress: LessonProgress = {
    lessonId,
    status: 'in_progress',
    currentStepId: lesson?.steps[0]?.id ?? '',
    completedStepIds: [],
    mistakes: 0,
    failedRoundTriggered: false,
    answers: {},
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
    earnedBadge: null,
  }
  await setDoc(progressRef(uid, lessonId), progress)
  return progress
}

/** Record the result of a single step attempt and persist it. */
export async function saveStepResult(
  uid: string,
  lessonId: string,
  stepId: string,
  result: {
    attempts: number
    isCorrect: boolean
    submittedValue: unknown
    addMistakes: number
    failedRoundTriggered: boolean
    completedStepIds: string[]
    mistakes: number
    nextStepId: string
  },
): Promise<void> {
  const answer: StepAnswer = {
    attempts: result.attempts,
    isCorrect: result.isCorrect,
    submittedValue: result.submittedValue ?? null,
    completedAt: serverTimestamp(),
  }
  await setDoc(
    progressRef(uid, lessonId),
    {
      lessonId,
      status: 'in_progress',
      currentStepId: result.nextStepId,
      completedStepIds: result.completedStepIds,
      mistakes: result.mistakes,
      failedRoundTriggered: result.failedRoundTriggered,
      answers: { [stepId]: answer },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function completeLesson(
  uid: string,
  lessonId: string,
  earnedBadge: BadgeType,
  updates: {
    unlockedLessonIds: string[]
    completedLessonIds: string[]
    streakCount: number
    lastLessonCompletedDate: string
    nextLessonId: string
  },
): Promise<void> {
  await setDoc(
    progressRef(uid, lessonId),
    {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      earnedBadge,
    },
    { merge: true },
  )
  await updateDoc(doc(db, 'users', uid), {
    unlockedLessonIds: updates.unlockedLessonIds,
    completedLessonIds: updates.completedLessonIds,
    streakCount: updates.streakCount,
    lastLessonCompletedDate: updates.lastLessonCompletedDate,
    currentLessonId: updates.nextLessonId,
    lastActiveAt: serverTimestamp(),
  })
}

/** Update only the earned badge on a completed lesson (used on replays). */
export async function setLessonBadge(
  uid: string,
  lessonId: string,
  earnedBadge: BadgeType,
): Promise<void> {
  await setDoc(
    progressRef(uid, lessonId),
    { earnedBadge, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** Store the chosen case track for the current run (first play). */
export async function setVariantTrack(
  uid: string,
  lessonId: string,
  variantTrack: number,
): Promise<void> {
  await setDoc(
    progressRef(uid, lessonId),
    { variantTrack, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/**
 * Start a fresh replay run on an already-completed lesson: clear the previous
 * run's answers/mistakes so the review reflects only the most recent run, and
 * record the newly chosen case track. The earned badge is kept.
 */
export async function beginReplayRun(
  uid: string,
  lessonId: string,
  variantTrack: number,
): Promise<void> {
  const lesson = lessons.find((l) => l.id === lessonId)
  await updateDoc(progressRef(uid, lessonId), {
    status: 'in_progress',
    currentStepId: lesson?.steps[0]?.id ?? '',
    completedStepIds: [],
    mistakes: 0,
    failedRoundTriggered: false,
    answers: {},
    variantTrack,
    updatedAt: serverTimestamp(),
  })
}

/** Mark a replay run complete (status + best badge), without touching streak/unlocks. */
export async function finishReplay(
  uid: string,
  lessonId: string,
  earnedBadge: BadgeType,
): Promise<void> {
  await updateDoc(progressRef(uid, lessonId), {
    status: 'completed',
    completedAt: serverTimestamp(),
    earnedBadge,
    updatedAt: serverTimestamp(),
  })
}

// ---------- Badges ----------

export async function awardBadge(uid: string, badge: BadgeRecord): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'badges', badge.badgeId), {
    ...badge,
    earnedAt: serverTimestamp(),
  })
}

export async function getBadges(uid: string): Promise<BadgeRecord[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'badges'))
  return snap.docs.map((d) => d.data() as BadgeRecord)
}
