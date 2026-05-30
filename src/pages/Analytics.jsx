import { collection, limit, orderBy, query } from "firebase/firestore";
import { BarChart3, CheckCircle2, Search, XCircle } from "lucide-react";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

export function Analytics() {
  const analytics = useFirestoreCollection(
    query(collection(db, "analytics", "daily", "days"), orderBy("date", "desc"), limit(30)),
    []
  );

  const totals = analytics.data.reduce(
    (acc, day) => ({
      total: acc.total + (Number(day.total) || 0),
      success: acc.success + (Number(day.success) || 0),
      lowSimilarity: acc.lowSimilarity + (Number(day.lowSimilarity) || 0),
      errors: acc.errors + (Number(day.errors) || 0)
    }),
    { total: 0, success: 0, lowSimilarity: 0, errors: 0 }
  );

  const maxTotal = Math.max(...analytics.data.map((day) => Number(day.total) || 0), 1);

  if (analytics.error) {
    return <EmptyState title="Could not load analytics" detail={analytics.error} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-white/45">Daily counters from `analytics/daily/days`.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={totals.total} detail="All analyzed events" icon={Search} />
        <MetricCard label="Success" value={totals.success} detail="Confident matches" icon={CheckCircle2} />
        <MetricCard label="Low similarity" value={totals.lowSimilarity} detail="Below threshold" icon={BarChart3} />
        <MetricCard label="Errors" value={totals.errors} detail="Failed events" icon={XCircle} />
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
                  <span className="text-sm text-white/55">{day.date || day.id}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-primary" style={{ width }} />
                  </div>
                  <span className="text-sm text-white/55">
                    {total} total / {day.success || 0} success / {day.errors || 0} errors
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
