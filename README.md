# Logic Locker

A detective-academy logic-puzzle learning web app for middle schoolers (grades 6–8).
Recruits unlock a hallway of locked challenge rooms by solving 7 hand-authored,
multi-step interactive logic lessons, guided by the grumpy mentor **Akash**.

Built with **React + Vite + TypeScript**, **Firebase** (Auth, Firestore, Hosting),
CSS-only animations, and **Vitest + React Testing Library**.

No AI, no generated content, no chatbot — every lesson is hand-authored local data.

---

## Features

- Email/password sign-up & login (Firebase Auth)
- Required display name + optional avatar (6 presets, no uploads)
- Hallway of 7 locked doors with locked / unlocked / in-progress / completed states
- 7 multi-step lessons (clue sort, deduction grids, logic switches, ordering, predictions, and more)
- Instant, specific feedback; guided reasoning after 2 wrong attempts
- Mistake tracking, gold/silver/bronze + retry badges
- Non-violent "ROUND FAILED" game-show animation at 7+ mistakes (review and continue)
- Final escape/completion animation
- Step-level progress that resumes exactly where you left off (saved to Firestore)
- Day-based completion streak
- Mobile-first responsive dark UI

---

## Quick start (local dev)

```bash
npm install
cp .env.example .env   # then fill in your Firebase keys (see below)
npm run dev
```

Without Firebase keys the app loads and shows a setup note on the login screen,
but sign-up/login and saving require a configured Firebase project.

### Scripts

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Start the Vite dev server             |
| `npm run build`    | Type-check and build to `dist/`       |
| `npm run preview`  | Preview the production build          |
| `npm test`         | Run the Vitest test suite             |
| `npm run lint`     | Run oxlint                            |

---

## Firebase setup (do this on your side)

You said your Firebase login isn't working yet — that's fine. Do these steps once
it is. Everything in the app is already wired; you only need to supply keys and run
a few CLI commands.

### Part A — Create the project & web app (Firebase Console)

1. Go to https://console.firebase.google.com and click **Add project**. Name it
   (e.g. `logic-locker`). You can disable Google Analytics.
2. In the project, open **Build → Authentication → Get started**, then under
   **Sign-in method** enable **Email/Password** and save.
3. Open **Build → Firestore Database → Create database**. Choose **Production mode**
   and pick a region close to you. (The security rules in this repo lock data to each
   user; we deploy them in Part C.)
4. Open **Project settings** (gear icon) → scroll to **Your apps** → click the
   **Web** icon (`</>`). Register an app (nickname `logic-locker-web`, no Hosting
   checkbox needed yet). Firebase shows a `firebaseConfig` object.

### Part B — Add your keys to `.env`

Copy `.env.example` to `.env` and paste the matching values from the `firebaseConfig`
object:

```bash
VITE_FIREBASE_API_KEY=...              # apiKey
VITE_FIREBASE_AUTH_DOMAIN=...          # authDomain (xxxx.firebaseapp.com)
VITE_FIREBASE_PROJECT_ID=...           # projectId
VITE_FIREBASE_STORAGE_BUCKET=...       # storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=...  # messagingSenderId
VITE_FIREBASE_APP_ID=...               # appId
```

Then run `npm run dev` and try creating an account. (`.env` is git-ignored — never
commit it. These web keys are not secret, but keep them out of version control.)

### Part C — Install the CLI, set the project, deploy rules & hosting

```bash
npm install -g firebase-tools          # if not already installed
firebase login                         # the step that needs to work on your side

# Point this repo at your project (replace with your real project id):
firebase use --add                     # pick your project, alias it "default"
# (this updates .firebaserc; it currently has the placeholder YOUR_FIREBASE_PROJECT_ID)

# Deploy the Firestore security rules (owner-only access):
firebase deploy --only firestore:rules

# Build the app and deploy to Firebase Hosting:
npm run build
firebase deploy --only hosting
```

After deploy, Firebase prints your public **Hosting URL** (e.g.
`https://logic-locker.web.app`). That's your live app.

> Note: `firebase.json` already configures Hosting to serve `dist/` with SPA
> rewrites, and points Firestore at `firestore.rules`. You do **not** need to run
> `firebase init`. If you do run it, do not let it overwrite `firebase.json`,
> `firestore.rules`, or the `dist` public directory setting.

### What to send me when you're ready

If you want me to verify or extend anything after setup, paste me:

- Your **Hosting URL** (so I can confirm it's live), and
- Any **error messages** from `npm run dev`, the browser console, or `firebase deploy`.

You do **not** need to send me the contents of your `.env` / API keys.

---

## Project structure

```txt
src/
  components/        # AkashDialog, Badge, DoorCard, FeedbackPanel, ProgressBar,
                     # ProtectedRoute, StepRenderer, RoundFailedOverlay, CompletionScreen
    steps/           # ChoiceStepView, ClueSortView, DeductionGridView,
                     # SingleCellGridView, LogicSwitchesView, OrderingView
  context/           # AuthContext (Firebase auth + profile)
  data/              # lessons.ts (all 7 lessons), avatars.ts
  firebase/          # firebaseConfig.ts, auth.ts, progress.ts
  logic/             # badgeLogic, gridCheckers, switchLogic, lessonUnlocks,
                     # progressHelpers, streak, stepUtils
  pages/             # AuthPage, ProfileSetupPage, HallwayPage, LessonPage, ProfilePage
  styles/            # global.css, animations.css
  tests/             # Vitest + RTL tests
  types.ts           # shared lesson + Firestore types
firebase.json        # Hosting + Firestore config
firestore.rules      # owner-only security rules
.firebaserc          # project alias (set with `firebase use --add`)
```

## Data model (Firestore)

Firestore stores **only** user data — never lesson content.

- `users/{uid}` — profile, current position, unlocked/completed lessons, streak
- `users/{uid}/progress/{lessonId}` — status, current step, completed steps,
  mistakes, per-step answers, earned badge
- `users/{uid}/badges/{badgeId}` — earned badge records

## Badges

| Badge                       | Condition                                              |
| --------------------------- | ----------------------------------------------------- |
| Gold — Master Detective     | 0–1 mistakes                                           |
| Silver — Case Solver        | 2–4 mistakes                                           |
| Bronze — Case Closed        | 5+ mistakes                                            |
| Retry — Back on the Case    | Completed after triggering a round failure (7+ misses) |

## Testing

```bash
npm test
```

Covers badge calculation, lesson unlock logic, deduction grid checking, AND/OR/NOT
switch evaluation, progress/step resume helpers, protected-route redirects, and
lesson step rendering by type.
