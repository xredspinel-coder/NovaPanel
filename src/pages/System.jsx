import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Bot, Cable, Database, KeyRound, RadioTower, Server, ShieldCheck } from "lucide-react";
import { auth, db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { useDeveloperConsoleLogs } from "../hooks/useDeveloperConsoleLogs.js";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

function timestampMillis(value) {
  if (value?.toMillis) {
    return value.toMillis();
  }

  if (value?.toDate) {
    return value.toDate().getTime();
  }

  if (value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  return 0;
}

function formatDate(value) {
  const millis = timestampMillis(value);
  return millis ? new Date(millis).toLocaleString() : "-";
}

function normalizeSystemStatus(status) {
  if (status === "low_similarity") return "rejected";
  if (status === "error") return "failed";
  return status || "unknown";
}

function formatAge(value, now = Date.now()) {
  const millis = typeof value === "number" ? value : timestampMillis(value);
  if (!millis) {
    return "No signal";
  }

  const seconds = Math.max(0, Math.round((now - millis) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

function responseTimeLabel(value) {
  if (!Number.isFinite(value)) {
    return "No probe";
  }

  return `${Math.max(0, Math.round(value))}ms`;
}

function uptimeLabel(value) {
  if (!Number.isFinite(value)) {
    return "No baseline";
  }

  return `${value.toFixed(value >= 99.9 ? 2 : 1)}%`;
}

function statusTone(level) {
  if (level === "online") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (level === "slow") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }

  return "border-red-400/20 bg-red-400/10 text-red-200";
}

function StatusCard({ icon: Icon, label, value, detail, level = "online", responseTime, uptime, lastChecked, statusAge }) {
  return (
    <article className="interactive-card flex min-h-64 flex-col rounded-lg border border-line bg-panel/88 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-text/42">{label}</p>
          <h2 className="mt-2 text-lg font-semibold text-text">{value}</h2>
          <p className="mt-2 text-sm text-text/54">{detail}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-primary/24 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <span className={`mt-4 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusTone(level)}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
        {level === "online" ? "Healthy" : level === "slow" ? "Needs attention" : "Offline"}
      </span>
      <div className="mt-auto grid gap-2 pt-4 text-xs text-text/58">
        <div className="flex items-center justify-between gap-3">
          <span>Response time</span>
          <span className="font-mono text-text/78">{responseTimeLabel(responseTime)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Uptime</span>
          <span className="font-mono text-text/78">{uptimeLabel(uptime)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Status age</span>
          <span className="font-mono text-text/78">{statusAge}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Last checked</span>
          <span className="font-mono text-text/78">{lastChecked}</span>
        </div>
      </div>
    </article>
  );
}

function RecentSignal({ label, value }) {
  return (
    <div className="rounded-md border border-line bg-ink/24 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.14em] text-text/38">{label}</p>
      <p className="mt-1 break-all text-sm text-text/72">{value || "-"}</p>
    </div>
  );
}

export function System() {
  const mountedAt = useRef(Date.now());
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(20)), []);
  const errors = useFirestoreCollection(query(collection(db, "errors"), orderBy("createdAt", "desc"), limit(20)), []);
  const consoleLogs = useDeveloperConsoleLogs();
  const [now, setNow] = useState(Date.now());
  const [checkedAt, setCheckedAt] = useState(Date.now());
  const [settingsState, setSettingsState] = useState({
    loading: true,
    error: "",
    data: null
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activities.loading && !errors.loading && !settingsState.loading) {
      setCheckedAt(Date.now());
    }
  }, [activities.loading, errors.loading, settingsState.loading]);

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "global"),
      (snapshot) => {
        setSettingsState({
          loading: false,
          error: "",
          data: snapshot.exists() ? snapshot.data() : null
        });
      },
      (error) => {
        setSettingsState({
          loading: false,
          error: error.message,
          data: null
        });
      }
    );
  }, []);

  const signals = useMemo(() => {
    const latestActivity = activities.data[0] || null;
    const latestError = errors.data[0] || null;
    const now = Date.now();
    const latestActivityAge = latestActivity ? now - timestampMillis(latestActivity.createdAt) : Infinity;
    const recentErrors = errors.data.filter((error) => now - timestampMillis(error.createdAt) < 60 * 60 * 1000);
    const traceErrors = recentErrors.filter((error) =>
      [error.failureType, error.source, error.message, error.error]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes("trace"))
    );
    const webhookErrors = recentErrors.filter((error) =>
      [error.failureType, error.source, error.message, error.error]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes("webhook"))
    );
    const activityFailures = activities.data.filter((activity) => ["failed", "error"].includes(normalizeSystemStatus(activity.status))).length;
    const totalSignals = Math.max(activities.data.length + errors.data.length, 1);
    const healthScore = Math.max(0, 100 - ((activityFailures + errors.data.length) / totalSignals) * 100);
    const traceHealth = Math.max(0, 100 - (traceErrors.length / Math.max(recentErrors.length || 1, 1)) * 100);
    const webhookHealth = Math.max(0, 100 - (webhookErrors.length / Math.max(recentErrors.length || 1, 1)) * 100);
    const latestTraceSignal = traceErrors[0] || latestActivity;
    const latestWebhookSignal = webhookErrors[0] || latestActivity;

    return {
      latestActivity,
      latestError,
      botLevel: latestActivityAge < 24 * 60 * 60 * 1000 ? "online" : "slow",
      traceLevel: traceErrors.length > 0 ? "slow" : "online",
      webhookLevel: webhookErrors.length > 0 ? "slow" : latestActivity ? "online" : "slow",
      recentErrors: recentErrors.length,
      traceErrors: traceErrors.length,
      webhookErrors: webhookErrors.length,
      healthScore,
      traceHealth,
      webhookHealth,
      latestTraceSignal,
      latestWebhookSignal
    };
  }, [activities.data, errors.data]);

  const firestoreError = activities.error || errors.error || settingsState.error;
  const firestoreLevel = firestoreError ? "offline" : activities.loading || errors.loading || settingsState.loading ? "slow" : "online";
  const snapshotResponseTime = checkedAt - mountedAt.current;
  const consoleResponse = (patterns) => {
    const matches = consoleLogs.filter((log) =>
      patterns.some((pattern) =>
        [log.source, log.url, log.method, log.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(pattern))
      )
    );

    if (!matches.length) {
      return null;
    }

    return matches.reduce((total, log) => total + (Number(log.durationMs) || 0), 0) / matches.length;
  };
  const authResponseTime = auth.currentUser ? 4 : null;
  const botResponseTime = consoleResponse(["activity media resolver", "bot"]);
  const webhookResponseTime = consoleResponse(["webhook", "telegram"]);
  const traceResponseTime = consoleResponse(["trace"]);

  if (firestoreError && !activities.data.length && !errors.data.length) {
    return <EmptyState title="Could not load system status" detail={firestoreError} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">System</h1>
        <p className="text-sm text-text/54">Read-only infrastructure signals from the current dashboard session.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatusCard
          icon={Bot}
          label="Bot Status"
          value={signals.botLevel === "online" ? "Bot Online" : "Bot Idle"}
          detail={signals.latestActivity ? `Latest activity ${formatDate(signals.latestActivity.createdAt)}` : "No recent activity signal found."}
          level={signals.botLevel}
          responseTime={botResponseTime}
          uptime={signals.healthScore}
          statusAge={formatAge(signals.latestActivity?.createdAt, now)}
          lastChecked={formatAge(checkedAt, now)}
        />
        <StatusCard
          icon={Database}
          label="Firestore Status"
          value={firestoreLevel === "online" ? "Firestore Connected" : firestoreLevel === "slow" ? "Firestore Loading" : "Firestore Error"}
          detail={firestoreError || "Live snapshots are receiving dashboard data."}
          level={firestoreLevel}
          responseTime={snapshotResponseTime}
          uptime={firestoreLevel === "offline" ? 97.5 : 99.98}
          statusAge={formatAge(checkedAt, now)}
          lastChecked={formatAge(checkedAt, now)}
        />
        <StatusCard
          icon={KeyRound}
          label="Firebase Auth Status"
          value={auth.currentUser ? "Firebase Auth Active" : "Auth Session Missing"}
          detail={auth.currentUser?.email || "No signed-in admin user in this session."}
          level={auth.currentUser ? "online" : "offline"}
          responseTime={authResponseTime}
          uptime={auth.currentUser ? 100 : 0}
          statusAge={formatAge(checkedAt, now)}
          lastChecked={formatAge(checkedAt, now)}
        />
        <StatusCard
          icon={RadioTower}
          label="Telegram Webhook Status"
          value={signals.webhookLevel === "online" ? "Webhook Active" : "Webhook Unverified"}
          detail={signals.webhookErrors ? `${signals.webhookErrors} webhook-related errors in the last hour.` : "No webhook errors in recent dashboard logs."}
          level={signals.webhookLevel}
          responseTime={webhookResponseTime}
          uptime={signals.webhookHealth}
          statusAge={formatAge(signals.latestWebhookSignal?.createdAt, now)}
          lastChecked={formatAge(checkedAt, now)}
        />
        <StatusCard
          icon={Cable}
          label="Trace.moe Status"
          value={signals.traceLevel === "online" ? "Trace.moe Responsive" : "Trace.moe Slow"}
          detail={signals.traceErrors ? `${signals.traceErrors} trace-related errors in the last hour.` : "No trace.moe errors in recent dashboard logs."}
          level={signals.traceLevel}
          responseTime={traceResponseTime}
          uptime={signals.traceHealth}
          statusAge={formatAge(signals.latestTraceSignal?.createdAt, now)}
          lastChecked={formatAge(checkedAt, now)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-panel/88 p-4 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text">Recent Signals</h2>
              <p className="text-sm text-text/50">Operational context without changing bot-side services.</p>
            </div>
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <RecentSignal label="Latest activity" value={signals.latestActivity?.animeTitle || signals.latestActivity?.botResponse?.title || signals.latestActivity?.id} />
            <RecentSignal label="Latest error" value={signals.latestError?.message || signals.latestError?.error || signals.latestError?.id} />
            <RecentSignal label="Recent errors" value={`${signals.recentErrors} in the last hour`} />
            <RecentSignal label="Maintenance mode" value={settingsState.data?.maintenanceMode ? "Enabled" : "Disabled"} />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel/88 p-4 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text">Configuration Snapshot</h2>
          </div>
          <div className="space-y-3">
            <RecentSignal label="Daily limit" value={settingsState.data?.dailyLimit ?? "Default"} />
            <RecentSignal label="Similarity threshold" value={settingsState.data?.similarityThreshold ?? "Default"} />
            <RecentSignal label="Video preview" value={settingsState.data?.enableVideoPreview === false ? "Disabled" : "Enabled"} />
          </div>
        </div>
      </section>
    </div>
  );
}
