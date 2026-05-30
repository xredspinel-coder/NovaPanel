import { useMemo, useState } from "react";
import { collection, doc, limit, orderBy, query, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";

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
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <p className="text-sm text-white/45">Limits, blocks, admin flag, and unlimited access.</p>
        </div>
        <input className={`${inputClass} sm:max-w-xs`} placeholder="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel backdrop-blur">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-white/35">
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
                <tr key={user.id} className="text-white/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{user.firstName || user.username || user.telegramId}</p>
                    <p className="text-xs text-white/40">@{user.username || "no_username"} / {user.telegramId}</p>
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
