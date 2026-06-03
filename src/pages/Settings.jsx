import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { AlertTriangle, Gauge, Link2, RotateCcw, Save, Sparkles } from "lucide-react";
import { db } from "../firebase.js";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

const defaultSettings = {
  dailyLimit: 5,
  similarityThreshold: 80,
  enableTwitter: true,
  enableReddit: true,
  enableFacebook: false,
  enableGenericLinks: true,
  enableRandomAnime: true,
  enableTopAnime: true,
  enableTrendingSearches: true,
  enableMyStatistics: true,
  enableMyUsage: true,
  maintenanceMode: false
};

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition duration-200 ${
        checked ? "border-primary/50 bg-primary/80" : "border-line bg-ink/54"
      }`}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow transition duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SectionCard({ icon: Icon, title, description, children, danger = false }) {
  return (
    <section className={`rounded-lg border ${danger ? "border-red-300/20 bg-red-400/5" : "border-line bg-panel/88"} p-4 backdrop-blur sm:p-5`}>
      <div className="mb-5 flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${danger ? "border-red-300/24 bg-red-400/10 text-red-200" : "border-primary/24 bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm text-text/52">{description}</p>
        </div>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function NumberSetting({ label, description, value, min, max, suffix, onChange }) {
  return (
    <label className="grid gap-3 rounded-md border border-line bg-ink/24 p-4 sm:grid-cols-[1fr_11rem] sm:items-center">
      <span>
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="mt-1 block text-sm text-text/52">{description}</span>
      </span>
      <span className="relative">
        <input
          className={`${inputClass} w-full pr-12`}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text/42">{suffix}</span> : null}
      </span>
    </label>
  );
}

function ToggleSetting({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-line bg-ink/24 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="mt-1 text-sm text-text/52">{description}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

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
    setSavedMessage("");
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function settingsPayload(source = settings) {
    return {
      dailyLimit: Number(source.dailyLimit),
      similarityThreshold: Number(source.similarityThreshold),
      enableTwitter: Boolean(source.enableTwitter),
      enableReddit: Boolean(source.enableReddit),
      enableFacebook: Boolean(source.enableFacebook),
      enableGenericLinks: Boolean(source.enableGenericLinks),
      enableRandomAnime: Boolean(source.enableRandomAnime),
      enableTopAnime: Boolean(source.enableTopAnime),
      enableTrendingSearches: Boolean(source.enableTrendingSearches),
      enableMyStatistics: Boolean(source.enableMyStatistics),
      enableMyUsage: Boolean(source.enableMyUsage),
      maintenanceMode: Boolean(source.maintenanceMode),
      updatedAt: serverTimestamp()
    };
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSavedMessage("");

    try {
      await setDoc(doc(db, "settings", "global"), settingsPayload(), { merge: true });
      setSavedMessage("Settings saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetSettings() {
    setSaving(true);
    setError("");
    setSavedMessage("");

    try {
      await setDoc(doc(db, "settings", "global"), settingsPayload(defaultSettings));
      setSettings(defaultSettings);
      setSavedMessage("Settings reset to default.");
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <EmptyState title="Loading settings" detail="Reading settings/global from Firestore." />;
  }

  return (
    <form onSubmit={saveSettings} className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Configuration</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Settings Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-text/54">
            Manage bot limits, supported sources, user-facing features, and operational safety from one clean settings surface.
          </p>
        </div>
        <button className={`${buttonClass} inline-flex items-center justify-center gap-2`} type="submit" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          icon={Gauge}
          title="Usage & Limits"
          description="Control the default quota and confidence gate for anime detection."
        >
          <NumberSetting
            label="Daily Limit"
            description="Maximum daily anime analyses for a regular Telegram user."
            value={settings.dailyLimit}
            min="0"
            onChange={(value) => patch("dailyLimit", value)}
          />
          <NumberSetting
            label="Similarity Threshold"
            description="Minimum confidence score required before a normal user receives a match."
            value={settings.similarityThreshold}
            min="0"
            max="100"
            suffix="%"
            onChange={(value) => patch("similarityThreshold", value)}
          />
        </SectionCard>

        <SectionCard
          icon={Link2}
          title="Supported Sources"
          description="Choose which external link sources the bot should accept."
        >
          <ToggleSetting
            label="Twitter/X Links"
            description="Allow users to submit Twitter/X media links when extraction is available."
            checked={Boolean(settings.enableTwitter)}
            onChange={(value) => patch("enableTwitter", value)}
          />
          <ToggleSetting
            label="Reddit Links"
            description="Allow Reddit image and media links as anime search inputs."
            checked={Boolean(settings.enableReddit)}
            onChange={(value) => patch("enableReddit", value)}
          />
          <ToggleSetting
            label="Facebook Links"
            description="Allow best-effort Facebook media links when supported by the resolver."
            checked={Boolean(settings.enableFacebook)}
            onChange={(value) => patch("enableFacebook", value)}
          />
          <ToggleSetting
            label="Generic Website Links"
            description="Allow safe public web pages to provide preview images from metadata when no direct image URL is sent."
            checked={Boolean(settings.enableGenericLinks)}
            onChange={(value) => patch("enableGenericLinks", value)}
          />
        </SectionCard>

        <SectionCard
          icon={Sparkles}
          title="User Features"
          description="These toggles control Telegram menu buttons, slash commands, and related dashboard widgets."
        >
          <ToggleSetting
            label="Random Anime"
            description="Let users request a random recommendation from successful search history."
            checked={Boolean(settings.enableRandomAnime)}
            onChange={(value) => patch("enableRandomAnime", value)}
          />
          <ToggleSetting
            label="Top Anime"
            description="Let users view the all-time most searched anime list."
            checked={Boolean(settings.enableTopAnime)}
            onChange={(value) => patch("enableTopAnime", value)}
          />
          <ToggleSetting
            label="Trending Searches"
            description="Let users view currently trending anime searches and show trending dashboard widgets."
            checked={Boolean(settings.enableTrendingSearches)}
            onChange={(value) => patch("enableTrendingSearches", value)}
          />
          <ToggleSetting
            label="My Statistics"
            description="Let users view their search totals, success rate, and most searched anime."
            checked={Boolean(settings.enableMyStatistics)}
            onChange={(value) => patch("enableMyStatistics", value)}
          />
          <ToggleSetting
            label="My Usage"
            description="Let users check daily quota usage, remaining searches, and reset status."
            checked={Boolean(settings.enableMyUsage)}
            onChange={(value) => patch("enableMyUsage", value)}
          />
        </SectionCard>

        <SectionCard
          icon={AlertTriangle}
          title="Danger Zone"
          description="Operational controls that can affect the live bot experience."
          danger
        >
          <ToggleSetting
            label="Maintenance Mode"
            description="Temporarily block regular users from running anime analyses while admins keep access."
            checked={Boolean(settings.maintenanceMode)}
            onChange={(value) => patch("maintenanceMode", value)}
          />
          <div className="flex flex-col gap-3 rounded-md border border-red-300/18 bg-red-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-red-100">Reset Settings To Default</p>
              <p className="mt-1 text-sm text-red-100/72">
                Restore the visible configuration center values to their default state.
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-300/28 px-4 text-sm text-red-100 transition hover:border-red-200 hover:bg-red-300/10"
              type="button"
              disabled={saving}
              onClick={resetSettings}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </SectionCard>
      </div>

      {error ? <p className="rounded-md border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      {savedMessage ? <p className="rounded-md border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{savedMessage}</p> : null}
    </form>
  );
}
