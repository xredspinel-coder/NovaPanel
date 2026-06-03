import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Activity, AlertTriangle, CheckCircle2, TrendingUp, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { db } from "../firebase.js";
import { MetricCard } from "../components/MetricCard.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { normalizeActivityStatus } from "../utils/activityTypes.js";

const TRENDING_WINDOW_HOURS = 24;
const defaultFeatureSettings = {
  enableTrendingSearches: true
};

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "Just now";
}

function timestampMillis(value) {
  if (value?.toMillis) {
    return value.toMillis();
  }

  if (value?.toDate) {
    return value.toDate().getTime();
  }

  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function chartTooltipStyle() {
  return {
    background: "color-mix(in srgb, var(--surface-color) 92%, black 8%)",
    border: "1px solid rgb(var(--line-rgb) / 0.16)",
    borderRadius: 6,
    color: "var(--text-color)"
  };
}

function ChartCard({ title, description, children, chartClassName = "" }) {
  return (
    <section className="rounded-lg border border-line bg-panel/88 p-4 backdrop-blur">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <p className="text-sm text-text/50">{description}</p>
      </div>
      <div className={`h-64 ${chartClassName}`}>{children}</div>
    </section>
  );
}

function activityLabel(activity) {
  return activity.animeTitle || activity.botResponse?.title || "Unknown";
}

function rankAnime(activities) {
  const counts = new Map();

  activities.forEach((activity) => {
    const name = activityLabel(activity);

    if (!name || name === "Unknown") {
      return;
    }

    counts.set(name, (counts.get(name) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

function HomeSkeleton() {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-line bg-panel/80 p-4">
            <div className="skeleton-block h-4 w-24" />
            <div className="skeleton-block mt-4 h-9 w-16" />
            <div className="skeleton-block mt-4 h-4 w-36" />
          </div>
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="skeleton-block h-80" />
        <div className="skeleton-block h-80" />
      </div>
    </div>
  );
}

export function Home() {
  const users = useFirestoreCollection(query(collection(db, "users"), limit(300)), []);
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(300)), []);
  const errors = useFirestoreCollection(query(collection(db, "errors"), orderBy("createdAt", "desc"), limit(50)), []);
  const [featureSettings, setFeatureSettings] = useState(defaultFeatureSettings);

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "global"), (snapshot) => {
      setFeatureSettings({
        ...defaultFeatureSettings,
        ...(snapshot.exists() ? snapshot.data() : {})
      });
    });
  }, []);

  const chartData = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (29 - index));
      return {
        date: dateKey(date),
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        total: 0,
        success: 0,
        rejected: 0
      };
    });
    const dayMap = new Map(days.map((day) => [day.date, day]));

    activities.data.forEach((activity) => {
      const millis = timestampMillis(activity.createdAt);
      if (!millis) {
        return;
      }

      const key = dateKey(new Date(millis));
      const day = dayMap.get(key);
      if (!day) {
        return;
      }

      const status = normalizeActivityStatus(activity.status);
      day.total += 1;
      if (status === "success") {
        day.success += 1;
      }
      if (status === "rejected") {
        day.rejected += 1;
      }
    });

    return days;
  })();

  const statusData = (() => {
    const totals = activities.data.reduce(
      (acc, activity) => {
        const status = normalizeActivityStatus(activity.status);
        if (status === "success") {
          acc.success += 1;
        }
        if (status === "rejected") {
          acc.rejected += 1;
        }
        return acc;
      },
      { success: 0, rejected: 0 }
    );

    return [
      { name: "Success", value: totals.success, color: "var(--primary-color)" },
      { name: "Rejected", value: totals.rejected, color: "#fbbf24" }
    ];
  })();

  const successful = statusData.find((item) => item.name === "Success")?.value || 0;
  const statusChartData = statusData.filter((item) => item.value > 0);
  const donutData = statusChartData.length
    ? statusChartData
    : [{ name: "No activity", value: 1, color: "rgb(var(--text-rgb) / 0.14)" }];
  const latestActivities = activities.data.slice(0, 8);
  const trendingCutoff = Date.now() - TRENDING_WINDOW_HOURS * 60 * 60 * 1000;
  const trendingAnime = rankAnime(
    activities.data.filter((activity) => normalizeActivityStatus(activity.status) === "success" && timestampMillis(activity.createdAt) >= trendingCutoff)
  );

  if (users.loading || activities.loading || errors.loading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={users.data.length} detail="Telegram users" icon={Users} />
        <MetricCard label="Recent success" value={successful} detail="Latest activity window" icon={CheckCircle2} />
        <MetricCard label="Activities" value={activities.data.length} detail="Recent searches" icon={Activity} />
        <MetricCard label="Errors" value={errors.data.length} detail="Logged failures" icon={AlertTriangle} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <ChartCard title="Activity Timeline" description="Last 30 days of analyses from Firestore activity records.">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="activityGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.42} />
                  <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} />
              <Area type="monotone" dataKey="total" name="Total" stroke="var(--primary-color)" strokeWidth={2} fill="url(#activityGradient)" />
              <Area type="monotone" dataKey="success" name="Success" stroke="#86efac" strokeWidth={1.8} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Success vs Rejected" description="Current activity window split by result." chartClassName="rounded-md">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={92}
                paddingAngle={0}
                cornerRadius={0}
                stroke="rgb(var(--background-rgb) / 1)"
                strokeWidth={6}
                strokeLinejoin="miter"
                startAngle={90}
                endAngle={-270}
              >
                {donutData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle()} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {featureSettings.enableTrendingSearches ? (
        <section className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text">Trending Searches</h2>
              <p className="text-sm text-text/50">Successful searches in the last {TRENDING_WINDOW_HOURS} hours.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          {trendingAnime.length === 0 ? (
            <p className="text-sm text-text/52">No trending successful searches yet.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {trendingAnime.map((item, index) => (
                <div key={item.name} className="rounded-md border border-line bg-ink/24 px-3 py-2">
                  <p className="truncate text-sm font-medium text-text">{index + 1}. {item.name}</p>
                  <p className="mt-1 text-xs text-primary">{item.count} searches</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Latest activity</h2>
          <span className="text-xs text-text/42">Firestore live</span>
        </div>

        {latestActivities.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-text/42">
                <tr>
                  <th className="py-3">Anime</th>
                  <th>Status</th>
                  <th>User</th>
                  <th>Similarity</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {latestActivities.map((activity) => (
                  <tr key={activity.id} className="text-text/72">
                    <td className="py-3 text-text">{activity.animeTitle || "Unknown"}</td>
                    <td><StatusPill status={normalizeActivityStatus(activity.status)} /></td>
                    <td>{activity.userId}</td>
                    <td>{activity.similarity ?? activity.botResponse?.similarity ?? "-"}%</td>
                    <td>{formatDate(activity.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
