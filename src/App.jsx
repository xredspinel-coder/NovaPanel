import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { motion } from "framer-motion";
import { LogOut, Palette, Settings as SettingsIcon, UserRound } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
import { System } from "./pages/System.jsx";
import { Profile } from "./pages/Profile.jsx";

const dashboardRoutes = [
  {
    path: "/",
    title: "Home",
    description: "Monitor NovaPanel activity, usage, and match quality.",
    component: Home
  },
  {
    path: "/users",
    title: "Users",
    description: "Manage Telegram users, limits and permissions.",
    component: Users
  },
  {
    path: "/activities",
    title: "Activities",
    description: "Manage anime detections and analysis history.",
    component: Activities
  },
  {
    path: "/analytics",
    title: "Analytics",
    description: "Review usage trends and match performance.",
    component: Analytics
  },
  {
    path: "/system",
    title: "System",
    description: "Monitor bot, Firebase, webhook, and trace.moe status.",
    component: System
  },
  {
    path: "/errors",
    title: "Errors",
    description: "Review system, media, and source failures.",
    component: Errors
  },
  {
    path: "/console",
    title: "Developer Console",
    description: "Inspect local request logs and JSON payloads.",
    component: DeveloperConsole
  }
];

const standaloneTitles = {
  "/profile": "Profile",
  "/appearance": "Appearance",
  "/settings": "Settings"
};

function routeForPath(pathname) {
  return dashboardRoutes.find((route) => route.path === pathname) || dashboardRoutes[0];
}

function isDashboardPath(pathname) {
  return dashboardRoutes.some((route) => route.path === pathname);
}

function AdminDropdown({ email, initial, onNavigate, onSignOut }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const items = [
    { label: "Profile", icon: UserRound, path: "/profile" },
    { label: "Appearance", icon: Palette, path: "/appearance" },
    { label: "Settings", icon: SettingsIcon, path: "/settings" }
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-md border border-line bg-panel/48 text-sm font-semibold text-primary transition duration-200 hover:border-primary/60"
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {initial}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-md border border-line bg-panel p-1 shadow-[0_18px_54px_rgb(0_0_0/0.34)]">
          <div className="flex items-center gap-3 border-b border-line px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/32 bg-primary/12 text-sm font-semibold text-primary">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">Profile</p>
              <p className="mt-1 truncate text-xs text-text/48">{email}</p>
            </div>
          </div>
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                type="button"
                className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-text/76 transition hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  setOpen(false);
                  onNavigate(item.path);
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-text/76 transition hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DashboardLayout({ authState }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isKnownDashboardPath = isDashboardPath(location.pathname);
  const pageMeta = routeForPath(location.pathname);
  const ActivePage = pageMeta.component;
  const userInitial = (authState.user.email || "N").trim().charAt(0).toUpperCase();

  useEffect(() => {
    document.title = `NovaPanel · ${pageMeta.title}`;
  }, [pageMeta.title]);

  if (!isKnownDashboardPath) {
    return <Navigate to="/" replace />;
  }

  function openStandalone(path) {
    navigate(path, {
      state: {
        from: isDashboardPath(location.pathname) ? location.pathname : "/"
      }
    });
  }

  return (
    <div className="min-h-screen bg-ink text-text">
      <Sidebar />
      <div className="pl-14">
        <header className="sticky top-0 z-10 border-b border-line bg-ink/82 px-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex min-h-16 max-w-[1800px] items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-primary">NovaPanel</p>
              <h1 className="mt-1 truncate text-xl font-semibold text-text">{pageMeta.title}</h1>
              <p className="hidden text-sm text-text/52 sm:block">{pageMeta.description}</p>
            </div>
            <AdminDropdown
              email={authState.user.email}
              initial={userInitial}
              onNavigate={openStandalone}
              onSignOut={() => signOut(auth)}
            />
          </div>
        </header>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="mx-auto max-w-[1800px] px-4 py-6 sm:px-8"
        >
          <ActivePage />
        </motion.main>
      </div>
    </div>
  );
}

function StandaloneLayout({ title, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const fallback = location.state?.from && isDashboardPath(location.state.from) ? location.state.from : "/";

  useEffect(() => {
    document.title = `NovaPanel · ${title}`;
  }, [title]);

  return (
    <main className="min-h-screen bg-ink px-4 py-6 text-text sm:px-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          className="mb-6 inline-flex h-10 items-center rounded-md border border-line px-4 text-sm text-text/72 transition hover:border-primary hover:text-primary"
          onClick={() => navigate(fallback)}
        >
          Back
        </button>
        <section className="rounded-lg border border-line bg-panel/62 p-4 shadow-[0_18px_70px_rgb(0_0_0/0.12)] backdrop-blur sm:p-6">
          {children}
        </section>
      </div>
    </main>
  );
}

function AuthenticatedApp() {
  const authState = useAuth();
  const appearanceTools = useAppearance();

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

  return (
    <Routes>
      <Route path="/appearance" element={<StandaloneLayout title={standaloneTitles["/appearance"]}><Appearance {...appearanceTools} /></StandaloneLayout>} />
      <Route path="/settings" element={<StandaloneLayout title={standaloneTitles["/settings"]}><Settings /></StandaloneLayout>} />
      <Route path="/profile" element={<StandaloneLayout title={standaloneTitles["/profile"]}><Profile authState={authState} /></StandaloneLayout>} />
      <Route path="/*" element={<DashboardLayout authState={authState} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthenticatedApp />
    </BrowserRouter>
  );
}
