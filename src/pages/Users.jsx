import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { Grid2X2, List, Trash2 } from "lucide-react";
import { db } from "../firebase.js";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { deleteFirestoreDocument } from "../utils/firestoreDelete.js";

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

function displayLimit(value) {
  return value === null || value === undefined || value === "" ? "Global" : value;
}

function userDocumentId(user) {
  return String(user.id || user.telegramId);
}

export function Users() {
  const users = useFirestoreCollection(query(collection(db, "users"), orderBy("lastSeenAt", "desc"), limit(300)), []);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = usePersistentState("novapanel-users-view", "list");
  const [globalDailyLimit, setGlobalDailyLimit] = useState(5);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "global"), (snapshot) => {
      const dailyLimit = snapshot.exists() ? snapshot.data().dailyLimit : null;
      setGlobalDailyLimit(dailyLimit !== null && dailyLimit !== undefined && Number.isFinite(Number(dailyLimit)) ? Number(dailyLimit) : 5);
    });
  }, []);

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

  function toggleSelected(userId, checked) {
    setSelectedUserIds((current) =>
      checked ? [...new Set([...current, userId])] : current.filter((id) => id !== userId)
    );
  }

  function requestDelete(ids) {
    setDeleteError("");
    setDeleteRequest({
      ids,
      title: ids.length === 1 ? "Delete User?" : "Delete Selected Users?",
      message: "This action cannot be undone."
    });
  }

  async function confirmDelete() {
    if (!deleteRequest?.ids?.length) {
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await Promise.all(deleteRequest.ids.map((id) => deleteFirestoreDocument(db, "users", id, { source: "users page delete" })));
      setSelectedUserIds([]);
      setSelectMode(false);
      setDeleteRequest(null);
    } catch (error) {
      setDeleteError(error.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  function cancelSelection() {
    setSelectMode(false);
    setSelectedUserIds([]);
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
          {selectMode ? (
            <>
              <span className="rounded-md border border-line px-3 py-2 text-sm text-text/62">{selectedUserIds.length} selected</span>
              {selectedUserIds.length > 0 ? (
                <button className={buttonClass} type="button" onClick={() => requestDelete(selectedUserIds)}>
                  Delete selected
                </button>
              ) : null}
              <button className={buttonClass} type="button" onClick={cancelSelection}>
                Cancel selection
              </button>
            </>
          ) : (
            <button className={buttonClass} type="button" onClick={() => setSelectMode(true)}>
              Select
            </button>
          )}
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
          {filtered.map((user) => {
            const docId = userDocumentId(user);
            const effectiveLimit = user.dailyLimitOverride ?? globalDailyLimit;

            return (
            <article key={user.id} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <label className="flex items-start gap-3">
                  {selectMode ? (
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={selectedUserIds.includes(docId)}
                      onChange={(event) => toggleSelected(docId, event.target.checked)}
                      aria-label={`Select ${user.username || user.telegramId}`}
                    />
                  ) : null}
                  <div>
                  <p className="text-lg font-semibold text-text">{user.firstName || user.username || user.telegramId}</p>
                  <p className="mt-1 text-sm text-text/52">@{user.username || "no_username"}</p>
                  <p className="mt-1 text-xs text-text/42">{user.telegramId}</p>
                  </div>
                </label>
                <span className={`rounded-full border px-2 py-1 text-xs ${user.isBlocked ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>
                  {user.isBlocked ? "blocked" : "active"}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-text/70">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text/42">Daily Limit</span>
                  <span className="text-text">{user.dailyUsed || 0} / {effectiveLimit}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text/42">Override Limit</span>
                  <span className="text-text">{displayLimit(user.dailyLimitOverride)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text/42">Unlimited Until</span>
                  <span className="text-right text-text">{formatDate(user.unlimitedUntil)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text/42">Account Status</span>
                  <span className="text-text">{user.isBlocked ? "Blocked" : user.isAdmin ? "Admin" : "Active"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text/42">Last Activity</span>
                  <span className="text-right text-text">{formatDate(user.lastSeenAt)}</span>
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
                <div className="flex flex-wrap gap-2">
                  <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isBlocked: !user.isBlocked })}>
                    {user.isBlocked ? "Unblock" : "Block"}
                  </button>
                  <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isAdmin: !user.isAdmin })}>
                    {user.isAdmin ? "Unset admin" : "Set admin"}
                  </button>
                  <button className={buttonClass} type="button" onClick={() => requestDelete([docId])}>
                    <Trash2 className="mr-2 inline h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel backdrop-blur">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-text/42">
              <tr>
                {selectMode ? <th className="px-4 py-3">Select</th> : null}
                <th className="px-4 py-3">User</th>
                <th>Daily Limit</th>
                <th>Override Limit</th>
                <th>Unlimited until</th>
                <th>Account Status</th>
                <th>Last Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((user) => {
                const docId = userDocumentId(user);
                const effectiveLimit = user.dailyLimitOverride ?? globalDailyLimit;

                return (
                <tr key={user.id} className="text-text/72">
                  {selectMode ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(docId)}
                        onChange={(event) => toggleSelected(docId, event.target.checked)}
                        aria-label={`Select ${user.username || user.telegramId}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{user.firstName || user.username || user.telegramId}</p>
                    <p className="text-xs text-text/46">@{user.username || "no_username"} / {user.telegramId}</p>
                  </td>
                  <td>{user.dailyUsed || 0} / {effectiveLimit}</td>
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
                  <td>{user.isBlocked ? "Blocked" : user.isAdmin ? "Admin" : "Active"}</td>
                  <td>{formatDate(user.lastSeenAt)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isBlocked: !user.isBlocked })}>
                        {user.isBlocked ? "Unblock" : "Block"}
                      </button>
                      <button className={buttonClass} type="button" onClick={() => patchUser(user.telegramId, { isAdmin: !user.isAdmin })}>
                        {user.isAdmin ? "Unset admin" : "Set admin"}
                      </button>
                      <button className={buttonClass} type="button" onClick={() => requestDelete([docId])}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteRequest)}
        title={deleteRequest?.title}
        message={deleteRequest?.message}
        confirmLabel="Delete"
        busy={deleting}
        error={deleteError}
        onCancel={() => setDeleteRequest(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
