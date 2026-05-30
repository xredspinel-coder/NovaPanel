import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase.js";
import { buttonClass, inputClass } from "../components/Field.jsx";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4 text-text">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-line bg-panel p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-primary">AniSeek</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Dashboard login</h1>
        <p className="mt-2 text-sm text-white/45">Use a Firebase Auth account that exists in `admins/uid`.</p>

        <div className="mt-6 space-y-4">
          <input
            className={inputClass}
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className={inputClass}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <button className={`mt-6 w-full ${buttonClass}`} type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
