import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { buttonClass, Field, inputClass } from "../components/Field.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

const defaultSettings = {
  dailyLimit: 5,
  similarityThreshold: 80,
  enableTwitter: true,
  enableReddit: true,
  enableFacebook: false,
  enableVideoPreview: true,
  maintenanceMode: false
};

export function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "global"),
      (snapshot) => {
        setSettings({
          ...defaultSettings,
          ...(snapshot.exists() ? snapshot.data() : {})
        });
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );
  }, []);

  function patch(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await setDoc(
        doc(db, "settings", "global"),
        {
          dailyLimit: Number(settings.dailyLimit),
          similarityThreshold: Number(settings.similarityThreshold),
          enableTwitter: Boolean(settings.enableTwitter),
          enableReddit: Boolean(settings.enableReddit),
          enableFacebook: Boolean(settings.enableFacebook),
          enableVideoPreview: Boolean(settings.enableVideoPreview),
          maintenanceMode: Boolean(settings.maintenanceMode),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <EmptyState title="Loading settings" detail="Reading settings/global from Firestore." />;
  }

  return (
    <form onSubmit={saveSettings} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/45">These values are stored in `settings/global` and read by the bot on user updates.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <Field label="Daily limit">
            <input className={inputClass} type="number" min="0" value={settings.dailyLimit} onChange={(event) => patch("dailyLimit", event.target.value)} />
          </Field>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <Field label="Similarity threshold">
            <input
              className={inputClass}
              type="number"
              min="0"
              max="100"
              value={settings.similarityThreshold}
              onChange={(event) => patch("similarityThreshold", event.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["enableTwitter", "Twitter/X links"],
            ["enableReddit", "Reddit links"],
            ["enableFacebook", "Facebook links"],
            ["enableVideoPreview", "Video preview"],
            ["maintenanceMode", "Maintenance mode"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-3 text-sm text-white/75">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={(event) => patch(key, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button className={buttonClass} type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
