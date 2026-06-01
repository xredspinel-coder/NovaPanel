import { useState } from "react";
import { signOut } from "firebase/auth";
import { motion } from "framer-motion";
import { auth } from "./firebase.js";
import { Sidebar } from "./layout/Sidebar.jsx";
import { useAppearance } from "./hooks/useAppearance.js";
import { useAuth } from "./hooks/useAuth.js";
import { Login } from "./pages/Login.jsx";
import { Home } from "./pages/Home.jsx";
import { Users } from "./pages/Users.jsx";
import { Activities } from "./pages/Activities.jsx";
import { Analytics } from "./pages/Analytics.jsx";
import { Settings } from "./pages/Settings.jsx";
import { Appearance } from "./pages/Appearance.jsx";
import { Errors } from "./pages/Errors.jsx";
import { DeveloperConsole } from "./pages/DeveloperConsole.jsx";

const pages = {
  home: Home,
  users: Users,
  activities: Activities,
  analytics: Analytics,
  settings: Settings,
  errors: Errors,
  "developer-console": DeveloperConsole
};

export default function App() {
  const authState = useAuth();
  const appearanceTools = useAppearance();
  const [page, setPage] = useState("home");

  if (authState.loading) {
    return <main className="grid min-h-screen place-items-center bg-ink text-sm text-text/58">Loading AniSeek...</main>;
  }

  if (!authState.user) {
    return <Login />;
  }

  if (!authState.isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-ink px-4 text-text">
        <div className="max-w-md rounded-lg border border-line bg-panel p-6 text-center backdrop-blur">
          <h1 className="text-xl font-semibold text-text">Admin access required</h1>
          <p className="mt-2 text-sm text-text/54">
            Signed in as <span className="text-text">{authState.user.email}</span>. This account must have an active
            admin document at <code className="text-primary">admins/{authState.user.uid}</code>.
          </p>
          <p className="mt-3 text-xs text-text/42">
            Required fields: <code>active: true</code> and <code>role: owner</code> or <code>role: admin</code>.
          </p>
          {authState.error ? <p className="mt-3 text-sm text-red-300">{authState.error}</p> : null}
          <button className="mt-6 rounded-md border border-primary/40 px-4 py-2 text-sm text-text transition hover:border-primary" type="button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const ActivePage = page === "appearance" ? null : pages[page] || Home;

  return (
    <div className="min-h-screen bg-ink text-text">
      <Sidebar currentPage={page} onChangePage={setPage} />
      <div className="pl-14">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-ink/80 px-4 backdrop-blur-xl sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">NovaPanel</p>
            <p className="text-sm text-text/52">{authState.user.email}</p>
          </div>
          <button className="rounded-md border border-line px-3 py-2 text-sm text-text/72 transition hover:border-primary hover:text-primary" type="button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </header>

        <motion.main
          key={page}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6"
        >
          {page === "appearance" ? <Appearance {...appearanceTools} /> : <ActivePage />}
        </motion.main>
      </div>
    </div>
  );
}
