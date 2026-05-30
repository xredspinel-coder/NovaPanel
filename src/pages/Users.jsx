import { useMemo, useState } from "react";
import { collection, doc, limit, orderBy, query, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { Grid2X2, List } from "lucide-react";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { usePersistentState } from "../hooks/usePersistentState.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
}

function toDatetimeLocal(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function Users() {
  const users = useFirestoreCollection(query(collection(db, "users"), orderBy("lastSeenAt", "desc"), limit(300)), []);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = usePersistentState("novapanel-users-view", "list");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return users.data;
    }

    return users.data.filter((user) =>
      [user.telegramId, user.username, user.firstName, user.lastName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [search, users.data]);

  async function patchUser(userId, payload) {
    await updateDoc(doc(db, "users", String(userId)), {
      ...payload,
      updatedAt: serverTimestamp()
    });
  }

  if (users.error) {
    return <EmptyState title="Could not load users" detail={users.error} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Users</h1>
          <p className="text-sm text-text/54">Limits, blocks, admin flag, and unlimited access.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className={`${inputClass} sm:max-w-xs`} placeholder="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="flex rounded-md border border-line bg-panel/60 p-1">
            {[
              ["grid", Grid2X2],
              ["list", List]
            ].map(([mode, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`grid h-9 w-9 place-items-center rounded text-text/58 transition hover:text-primary ${viewMode === mode ? "text-primary" : ""}`}
                aria-label={`${mode} view`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((user) => (
            <article key={user.id} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-text">{user.firstName || user.username || user.telegramId}</p>
                  <p className="mt-1 text-sm text-text/52">@{user.username || "no_username"}</p>
                  <p className="mt-1 text-xs text-text/42">{user.telegramId}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs ${user.isBlocked ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>
                  {user.isBlocked ? "blocked" : "active"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-line bg-ink/20 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-text/38">Daily used</p>
                  <p className="mt-1 text-text">{user.dailyUsed || 0}</p>
                </div>
                <div className="rounded-md border border-line bg-ink/20 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-text/38">Override</p>
                  <p className="mt-1 text-text">{user.dailyLimitOverride ?? "global"}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  defaultValue={user.dailyLimitOverride ?? ""}
                  placeholder="global limit"
                  onBlur={(event) =>
                    patchUser(user.telegramId, {
                      dailyLimitOverride: event.target.value === "" ? null : Number(event.target.value)
                    })
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isBlocked: !user.isBlocked })}>
                    {user.isBlocked ? "Unblock" : "Block"}
                  </button>
                  <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isAdmin: !user.isAdmin })}>
                    {user.isAdmin ? "Unset admin" : "Set admin"}
                  </button>
                </div>
                <p className="text-xs text-text/42">Last seen: {formatDate(user.lastSeenAt)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel backdrop-blur">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-text/42">
              <tr>
                <th className="px-4 py-3">User</th>
                <th>Daily</th>
                <th>Override</th>
                <th>Unlimited until</th>
                <th>Flags</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((user) => (
                <tr key={user.id} className="text-text/72">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{user.firstName || user.username || user.telegramId}</p>
                    <p className="text-xs text-text/46">@{user.username || "no_username"} / {user.telegramId}</p>
                  </td>
                  <td>{user.dailyUsed || 0}</td>
                  <td className="w-36">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      defaultValue={user.dailyLimitOverride ?? ""}
                      placeholder="global"
                      onBlur={(event) =>
                        patchUser(user.telegramId, {
                          dailyLimitOverride: event.target.value === "" ? null : Number(event.target.value)
                        })
                      }
                    />
                  </td>
                  <td className="w-56">
                    <input
                      className={inputClass}
                      type="datetime-local"
                      defaultValue={toDatetimeLocal(user.unlimitedUntil)}
                      onBlur={(event) =>
                        patchUser(user.telegramId, {
                          unlimitedUntil: event.target.value ? Timestamp.fromDate(new Date(event.target.value)) : null
                        })
                      }
                    />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isBlocked: !user.isBlocked })}>
                        {user.isBlocked ? "Unblock" : "Block"}
                      </button>
                      <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isAdmin: !user.isAdmin })}>
                        {user.isAdmin ? "Unset admin" : "Set admin"}
                      </button>
                    </div>
                  </td>
                  <td>{formatDate(user.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
