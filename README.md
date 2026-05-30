# AniSeekDashboard

AniSeekDashboard is a standalone Vite React app. It does not call the bot server and does not know the bot `BASE_URL`. It uses Firebase Auth and Firestore directly.

## Stack

- React
- Vite
- TailwindCSS
- Firebase Client SDK
- Firebase Auth
- Firestore
- Lucide icons
- Framer Motion

## Environment

Copy `.env.example` to `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

There is no `VITE_API_BASE_URL`.

## Local Development

```bash
npm install
npm run dev
```

The dev server opens on `http://localhost:5176` and keeps running until you stop it with `Ctrl+C`. This is normal Vite behavior, not a failing command.

For a quick verification run, use build instead of dev:

```bash
npm run build
```

The app checks the signed-in Firebase user against `admins/{uid}`. Create the first admin document from the Firebase console or with the Admin SDK before using the dashboard.

## Firestore Rules

The dashboard owns the client security rules file:

```text
AniSeekDashboard/firestore.rules
```

Deploy those rules with Firebase CLI from this folder or point your Firebase config at this file.

## Deployment

Deploy this folder by itself to any static host:

```bash
npm install
npm run build
```

Upload `dist/`. The Telegram bot is not required on the dashboard host.

## Pages

- Home
- Users
- Activities
- Analytics
- Settings
- Appearance
- Errors
