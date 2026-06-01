import { useEffect, useRef, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase.js";
import { buttonClass, inputClass } from "../components/Field.jsx";

function loginErrorMessage(error) {
  if (error?.code === "auth/too-many-requests") {
    return "Too many login attempts. Please wait a few minutes before trying again.";
  }

  if (error?.code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password" || error?.code === "auth/user-not-found") {
    const projectId = auth.app?.options?.projectId;
    const projectHint = projectId ? ` in Firebase project "${projectId}"` : " in the configured Firebase project";

    return `Firebase rejected these credentials (${error.code}). Make sure this email/password exists${projectHint}.`;
  }

  if (error?.code === "auth/network-request-failed") {
    return "Could not reach Firebase Auth. Check your connection and try again.";
  }

  return error?.message || "Login failed. Please try again.";
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(false);
  const signInInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      signInInFlightRef.current = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (signInInFlightRef.current) {
      return;
    }

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setError("");
    signInInFlightRef.current = true;
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (loginError) {
      if (mountedRef.current) {
        setError(loginErrorMessage(loginError));
      }
    } finally {
      signInInFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4 text-text">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-line bg-panel p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-primary">NovaPanel</p>
        <h1 className="mt-3 text-2xl font-semibold text-text">Dashboard login</h1>
        <p className="mt-2 text-sm text-text/54">
          Use a Firebase Auth account with an active `admins/uid` document.
        </p>

        <div className="mt-6 space-y-4">
          <input
            className={inputClass}
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            required
          />
          <input
            className={inputClass}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            required
          />
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <button className={`mt-6 w-full disabled:cursor-wait disabled:opacity-60 ${buttonClass}`} type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
