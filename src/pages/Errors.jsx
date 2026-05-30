import { useMemo, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { inputClass } from "../components/Field.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
}

export function Errors() {
  const errors = useFirestoreCollection(query(collection(db, "errors"), orderBy("createdAt", "desc"), limit(300)), []);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return errors.data;
    }

    return errors.data.filter((error) =>
      [error.message, error.userId, error.source, error.inputUrl]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [errors.data, search]);

  if (errors.error) {
    return <EmptyState title="Could not load errors" detail={errors.error} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Errors</h1>
          <p className="text-sm text-text/54">Bot failures written to the `errors` collection.</p>
        </div>
        <input className={`${inputClass} sm:max-w-xs`} placeholder="Search errors" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={errors.data.length === 0 ? "No errors logged" : "No errors found"} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel backdrop-blur">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-text/42">
              <tr>
                <th className="px-4 py-3">Message</th>
                <th>User</th>
                <th>Source</th>
                <th>Input</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((error) => (
                <tr key={error.id} className="text-text/72">
                  <td className="px-4 py-3 text-text">{error.message || "Unknown error"}</td>
                  <td>{error.userId || "-"}</td>
                  <td>{error.source || "-"}</td>
                  <td className="max-w-xs truncate">{error.inputUrl || "-"}</td>
                  <td>{formatDate(error.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
