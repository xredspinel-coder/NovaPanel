import { collection, limit, orderBy, query } from "firebase/firestore";
import { BarChart3, CheckCircle2, TrendingUp, XCircle } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

function normalizeStatus(status) {
  if (status === "low_similarity") return "rejected";
  if (status === "error") return "failed";
  return status || "unknown";
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

function ChartCard({ title, description, children, height = "h-72" }) {
  return (
    <section className="rounded-lg border border-line bg-panel/88 p-4 backdrop-blur">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {description ? <p className="text-sm text-text/50">{description}</p> : null}
      </div>
      <div className={height}>{children}</div>
    </section>
  );
}

function activityLabel(activity) {
  return activity.animeTitle || activity.botResponse?.title || "Unknown";
}

function userLabel(activity) {
  return activity.user?.displayName || activity.user?.username || activity.userId || "Unknown";
}

function similarityValue(activity) {
  const value = Number(activity.similarity ?? activity.botResponse?.similarity);
  return Number.isFinite(value) ? value : null;
}

export function Analytics() {
  const analytics = useFirestoreCollection(
    query(collection(db, "analytics", "daily", "days"), orderBy("date", "desc"), limit(30)),
    []
  );
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(500)), []);

  const totals = activities.data.reduce(
    (acc, activity) => {
      const status = normalizeStatus(activity.status);
      const similarity = similarityValue(activity);
      const animeTitle = activityLabel(activity);
      const activeUser = userLabel(activity);

      acc.total += 1;
      if (status === "success") acc.success += 1;
      if (status === "rejected") acc.rejected += 1;
      if (status === "failed") acc.failed += 1;
      if (similarity !== null) {
        acc.similarityTotal += similarity;
        acc.similarityCount += 1;
      }
      if (animeTitle) acc.animeCounts.set(animeTitle, (acc.animeCounts.get(animeTitle) || 0) + 1);
      if (activeUser) acc.userCounts.set(activeUser, (acc.userCounts.get(activeUser) || 0) + 1);
      return acc;
    },
    {
      total: 0,
      success: 0,
      rejected: 0,
      failed: 0,
      similarityTotal: 0,
      similarityCount: 0,
      animeCounts: new Map(),
      userCounts: new Map()
    }
  );

  const averageSimilarity = totals.similarityCount > 0
    ? Math.round((totals.similarityTotal / totals.similarityCount) * 10) / 10
    : 0;

  const analyticsByDate = new Map(analytics.data.map((day) => [day.date || day.id, day]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const trendData = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    return {
      date: dateKey(date),
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      total: 0,
      success: 0,
      rejected: 0,
      failed: 0,
      usage: 0,
      successRate: 0,
      averageSimilarity: 0,
      similarityTotal: 0,
      similarityCount: 0
    };
  });
  const trendByDate = new Map(trendData.map((day) => [day.date, day]));

  activities.data.forEach((activity) => {
    const millis = timestampMillis(activity.createdAt);
    if (!millis) {
      return;
    }

    const day = trendByDate.get(dateKey(new Date(millis)));
    if (!day) {
      return;
    }

    const status = normalizeStatus(activity.status);
    const similarity = similarityValue(activity);
    day.total += 1;
    if (status === "success") day.success += 1;
    if (status === "rejected") day.rejected += 1;
    if (status === "failed") day.failed += 1;
    if (similarity !== null) {
      day.similarityTotal += similarity;
      day.similarityCount += 1;
    }
  });

  trendData.forEach((day) => {
    const analyticsDay = analyticsByDate.get(day.date);
    const analyticsTotal = Number(analyticsDay?.total);
    const analyticsSuccess = Number(analyticsDay?.success);
    const analyticsRejected = Number(analyticsDay?.rejected ?? analyticsDay?.lowSimilarity);
    const analyticsFailed = Number(analyticsDay?.failed ?? analyticsDay?.errors);

    if (Number.isFinite(analyticsTotal) && analyticsTotal > day.total) {
      day.total = analyticsTotal;
    }
    if (Number.isFinite(analyticsSuccess) && analyticsSuccess > day.success) {
      day.success = analyticsSuccess;
    }
    if (Number.isFinite(analyticsRejected) && analyticsRejected > day.rejected) {
      day.rejected = analyticsRejected;
    }
    if (Number.isFinite(analyticsFailed) && analyticsFailed > day.failed) {
      day.failed = analyticsFailed;
    }

    day.usage = day.total;
    day.successRate = day.total ? Math.round((day.success / day.total) * 100) : 0;
    day.averageSimilarity = day.similarityCount
      ? Math.round((day.similarityTotal / day.similarityCount) * 10) / 10
      : 0;
  });

  const topSearchedAnime = [...totals.animeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  const topActiveUsers = [...totals.userCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const similarityDistribution = [
    { name: "0-59", count: 0 },
    { name: "60-69", count: 0 },
    { name: "70-79", count: 0 },
    { name: "80-89", count: 0 },
    { name: "90-100", count: 0 }
  ];

  activities.data.forEach((activity) => {
    const similarity = similarityValue(activity);
    if (similarity === null) {
      return;
    }

    if (similarity < 60) similarityDistribution[0].count += 1;
    else if (similarity < 70) similarityDistribution[1].count += 1;
    else if (similarity < 80) similarityDistribution[2].count += 1;
    else if (similarity < 90) similarityDistribution[3].count += 1;
    else similarityDistribution[4].count += 1;
  });

  const loadError = analytics.error || activities.error;

  if (loadError) {
    return <EmptyState title="Could not load analytics" detail={loadError} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Analytics</h1>
        <p className="text-sm text-text/54">Performance, usage, and match-quality trends from recent activity.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Successful" value={totals.success} detail="Quota-consuming analyses" icon={CheckCircle2} />
        <MetricCard label="Rejected" value={totals.rejected} detail="No quota consumed" icon={BarChart3} />
        <MetricCard label="Failed" value={totals.failed} detail="Processing/API failures" icon={XCircle} />
        <MetricCard label="Avg similarity" value={`${averageSimilarity}%`} detail={`${totals.similarityCount} scored results`} icon={TrendingUp} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Activity Trend" description="Total, successful, and rejected analyses over time.">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} />
              <Area type="monotone" dataKey="total" name="Total" stroke="var(--primary-color)" fill="rgb(var(--primary-rgb) / 0.16)" strokeWidth={2} />
              <Area type="monotone" dataKey="success" name="Success" stroke="#86efac" fill="rgb(134 239 172 / 0.08)" strokeWidth={1.8} />
              <Area type="monotone" dataKey="rejected" name="Rejected" stroke="#fbbf24" fill="rgb(251 191 36 / 0.08)" strokeWidth={1.8} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Success Rate Trend" description="Successful analyses as a percentage of daily activity.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis domain={[0, 100]} tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} formatter={(value) => `${value}%`} />
              <Line type="monotone" dataKey="successRate" name="Success rate" stroke="var(--primary-color)" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Similarity Trend" description="Average similarity score by day.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis domain={[0, 100]} tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} formatter={(value) => `${value}%`} />
              <Line type="monotone" dataKey="averageSimilarity" name="Avg similarity" stroke="#c4b5fd" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily Usage Trend" description="Daily request volume from activity and analytics counters.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} />
              <Bar dataKey="usage" name="Usage" fill="var(--primary-color)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Top Searched Anime" description="Most common matched titles in the recent activity window.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSearchedAnime} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={142} tick={{ fill: "rgb(var(--text-rgb) / 0.58)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} />
              <Bar dataKey="count" name="Searches" fill="var(--primary-color)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Active Users" description="Users with the most recent analyses.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topActiveUsers} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={142} tick={{ fill: "rgb(var(--text-rgb) / 0.58)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} />
              <Bar dataKey="count" name="Analyses" fill="#c4b5fd" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <ChartCard title="Similarity Distribution" description="Recent trace.moe match confidence grouped by score range." height="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={similarityDistribution} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--text-rgb) / 0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "rgb(var(--text-rgb) / 0.52)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "rgb(var(--text-rgb) / 0.46)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-color)" }} />
            <Bar dataKey="count" name="Activities" fill="var(--primary-color)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
