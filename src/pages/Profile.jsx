import { signOut } from "firebase/auth";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { auth, firebaseApp } from "../firebase.js";
import { buttonClass } from "../components/Field.jsx";

function InfoCell({ label, value }) {
  return (
    <div className="rounded-md border border-line bg-ink/24 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-text/38">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-text/78">{value || "-"}</p>
    </div>
  );
}

export function Profile({ authState }) {
  const user = authState.user;
  const admin = authState.admin || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-primary/32 bg-primary/12 text-lg font-semibold text-primary">
            {(user.email || "N").trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary">Profile</p>
            <h1 className="mt-1 text-2xl font-semibold text-text">Admin Profile</h1>
            <p className="text-sm text-text/54">Signed-in Firebase administrator for NovaPanel.</p>
          </div>
        </div>
        <button className={`${buttonClass} inline-flex gap-2`} type="button" onClick={() => signOut(auth)}>
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <InfoCell label="Email" value={user.email} />
        <InfoCell label="UID" value={user.uid} />
        <InfoCell label="Role" value={admin.role || "admin"} />
        <InfoCell label="Active admin status" value={authState.isAdmin && admin.active !== false ? "Active" : "Inactive"} />
        <InfoCell label="Firebase project ID" value={firebaseApp.options.projectId} />
        <InfoCell label="Provider" value={user.providerData?.[0]?.providerId || "firebase"} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel/78 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-text">Admin Access</h2>
          </div>
          <p className="text-sm text-text/58">
            Access is granted by the existing <code className="text-primary">admins/{user.uid}</code> document. No auth or Firestore structure changes were made.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-panel/78 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-text">Session</h2>
          </div>
          <p className="text-sm text-text/58">
            Profile data comes from the current Firebase Auth session and the already-loaded admin verification state.
          </p>
        </div>
      </section>
    </div>
  );
}
