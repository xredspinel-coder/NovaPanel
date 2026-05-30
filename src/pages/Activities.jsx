import { useMemo, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { inputClass } from "../components/Field.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
}

export function Activities() {
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(300)), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activities.data.filter((activity) => {
      const matchesStatus = status === "all" || activity.status === status;
      const matchesSearch =
        !needle ||
        [activity.animeTitle, activity.userId, activity.source, activity.anilistId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [activities.data, search, status]);

  if (activities.error) {
    return <EmptyState title="Could not load activities" detail={activities.error} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Activities</h1>
          <p className="text-sm text-white/45">Scene results written directly by the bot.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className={inputClass} placeholder="Search activity" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="low_similarity">Low similarity</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No activities found" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel backdrop-blur">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-white/35">
              <tr>
                <th className="px-4 py-3">Anime</th>
                <th>Status</th>
                <th>Source</th>
                <th>Time</th>
                <th>Similarity</th>
                <th>Links</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((activity) => (
                <tr key={activity.id} className="text-white/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{activity.animeTitle || "Unknown"}</p>
                    <p className="text-xs text-white/40">{activity.userId}</p>
                  </td>
                  <td><StatusPill status={activity.status} /></td>
                  <td>{activity.source || "-"}</td>
                  <td>{activity.formattedTime || "-"}</td>
                  <td>{activity.similarity ?? "-"}%</td>
                  <td>
                    <div className="flex gap-3">
                      {activity.anilistUrl ? <a className="text-primary hover:text-white" href={activity.anilistUrl} target="_blank" rel="noreferrer">AniList</a> : null}
                      {activity.videoUrl ? <a className="text-primary hover:text-white" href={activity.videoUrl} target="_blank" rel="noreferrer">Video</a> : null}
                    </div>
                  </td>
                  <td>{formatDate(activity.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
