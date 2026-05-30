import { collection, limit, orderBy, query } from "firebase/firestore";
import { Activity, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { db } from "../firebase.js";
import { MetricCard } from "../components/MetricCard.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "Just now";
}

export function Home() {
  const users = useFirestoreCollection(query(collection(db, "users"), limit(300)), []);
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(8)), []);
  const errors = useFirestoreCollection(query(collection(db, "errors"), orderBy("createdAt", "desc"), limit(50)), []);

  const successful = activities.data.filter((activity) => activity.status === "success").length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={users.data.length} detail="Telegram users" icon={Users} />
        <MetricCard label="Recent success" value={successful} detail="Latest activity window" icon={CheckCircle2} />
        <MetricCard label="Activities" value={activities.data.length} detail="Recent searches" icon={Activity} />
        <MetricCard label="Errors" value={errors.data.length} detail="Logged failures" icon={AlertTriangle} />
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Latest activity</h2>
          <span className="text-xs text-white/35">Firestore live</span>
        </div>

        {activities.data.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-white/35">
                <tr>
                  <th className="py-3">Anime</th>
                  <th>Status</th>
                  <th>User</th>
                  <th>Similarity</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activities.data.map((activity) => (
                  <tr key={activity.id} className="text-white/70">
                    <td className="py-3 text-white">{activity.animeTitle || "Unknown"}</td>
                    <td><StatusPill status={activity.status} /></td>
                    <td>{activity.userId}</td>
                    <td>{activity.similarity ?? "-"}%</td>
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
