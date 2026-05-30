import { collection, limit, orderBy, query } from "firebase/firestore";
import { BarChart3, CheckCircle2, TrendingUp, UserRound, XCircle } from "lucide-react";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

export function Analytics() {
  const analytics = useFirestoreCollection(
    query(collection(db, "analytics", "daily", "days"), orderBy("date", "desc"), limit(30)),
    []
  );
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(500)), []);

  function normalizeStatus(status) {
    if (status === "low_similarity") return "rejected";
    if (status === "error") return "failed";
    return status || "unknown";
  }

  const totals = activities.data.reduce(
    (acc, activity) => {
      const status = normalizeStatus(activity.status);
      const similarity = Number(activity.similarity);
      const animeTitle = activity.animeTitle || activity.botResponse?.title;
      const userLabel = activity.user?.displayName || activity.user?.username || activity.userId;

      acc.total += 1;
      if (status === "success") acc.success += 1;
      if (status === "rejected") acc.rejected += 1;
      if (status === "failed") acc.failed += 1;
      if (Number.isFinite(similarity)) {
        acc.similarityTotal += similarity;
        acc.similarityCount += 1;
      }
      if (animeTitle) acc.animeCounts.set(animeTitle, (acc.animeCounts.get(animeTitle) || 0) + 1);
      if (userLabel) acc.userCounts.set(userLabel, (acc.userCounts.get(userLabel) || 0) + 1);
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
  const mostSearchedAnime = [...totals.animeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mostActiveUsers = [...totals.userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const maxTotal = Math.max(...analytics.data.map((day) => Number(day.total) || 0), 1);

  if (analytics.error) {
    return <EmptyState title="Could not load analytics" detail={analytics.error} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Analytics</h1>
        <p className="text-sm text-text/54">Daily counters from `analytics/daily/days`.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Successful" value={totals.success} detail="Quota-consuming analyses" icon={CheckCircle2} />
        <MetricCard label="Rejected" value={totals.rejected} detail="No quota consumed" icon={BarChart3} />
        <MetricCard label="Failed" value={totals.failed} detail="Processing/API failures" icon={XCircle} />
        <MetricCard label="Avg similarity" value={`${averageSimilarity}%`} detail={`${totals.similarityCount} scored results`} icon={TrendingUp} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-text">Most searched anime</h2>
          <div className="mt-4 space-y-3">
            {mostSearchedAnime.length === 0 ? (
              <p className="text-sm text-text/52">No anime activity yet.</p>
            ) : mostSearchedAnime.map(([title, count]) => (
              <div key={title} className="flex items-center justify-between gap-4 rounded-md border border-line bg-ink/20 px-3 py-2">
                <span className="truncate text-sm text-text">{title}</span>
                <span className="text-sm text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-text">Most active users</h2>
          <div className="mt-4 space-y-3">
            {mostActiveUsers.length === 0 ? (
              <p className="text-sm text-text/52">No user activity yet.</p>
            ) : mostActiveUsers.map(([user, count]) => (
              <div key={user} className="flex items-center justify-between gap-4 rounded-md border border-line bg-ink/20 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-text">
                  <UserRound className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{user}</span>
                </span>
                <span className="text-sm text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {analytics.data.length === 0 ? (
        <EmptyState title="No analytics yet" />
      ) : (
        <section className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <div className="space-y-3">
            {analytics.data.map((day) => {
              const total = Number(day.total) || 0;
              const width = `${Math.max(4, (total / maxTotal) * 100)}%`;

              return (
                <div key={day.id} className="grid gap-2 md:grid-cols-[120px_1fr_220px] md:items-center">
                  <span className="text-sm text-text/62">{day.date || day.id}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-text/8">
                    <div className="h-full rounded-full bg-primary" style={{ width }} />
                  </div>
                  <span className="text-sm text-text/62">
                    {total} total / {day.success || 0} success / {day.rejected || day.lowSimilarity || 0} rejected / {day.failed || day.errors || 0} failed
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
