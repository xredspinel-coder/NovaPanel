import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { BadgeCheck, CalendarClock, CheckCircle2, Shield, ShieldOff, Trash2, UserRound } from "lucide-react";
import { db } from "../firebase.js";
import { ActionMenu } from "../components/ActionMenu.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Drawer } from "../components/Drawer.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { SelectionToolbar } from "../components/SelectionToolbar.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { normalizeActivityStatus } from "../utils/activityTypes.js";
import { deleteFirestoreDocument } from "../utils/firestoreDelete.js";

const defaultFeatureSettings = {
  enableMyStatistics: true,
  enableMyUsage: true
};

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
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

function toDatetimeLocal(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function userDocumentId(user) {
  return String(user.id || user.telegramId);
}

function userDisplayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.telegramId || "Unknown user";
}

function accountStatus(user) {
  if (user.isBlocked) {
    return "Blocked";
  }

  return "Active";
}

function accountTone(user) {
  if (user.isBlocked) {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }

  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

function isUnlimitedActive(user) {
  const until = timestampMillis(user.unlimitedUntil);
  return until > Date.now();
}

function isTrustedActive(user) {
  const until = timestampMillis(user.trustedUntil);
  return Boolean(user.trustedUser) && (!until || until > Date.now());
}

function dailyLimitValue(user, globalDailyLimit) {
  return user.dailyLimitOverride ?? globalDailyLimit;
}

function remainingUsageLabel(user, globalDailyLimit) {
  if (isUnlimitedActive(user)) {
    return "Unlimited";
  }

  return Math.max(0, Number(dailyLimitValue(user, globalDailyLimit)) - Number(user.dailyUsed || 0));
}

function dailyUsageLabel(user, globalDailyLimit) {
  if (isUnlimitedActive(user)) {
    return `${user.dailyUsed || 0} / Unlimited`;
  }

  return `${user.dailyUsed || 0} / ${dailyLimitValue(user, globalDailyLimit)}`;
}

function DetailStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-md border border-line bg-ink/24 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-text/38">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
      </div>
      <p className="mt-2 break-all text-sm font-medium text-text/78">{value === null || value === undefined || value === "" ? "-" : value}</p>
    </div>
  );
}

function UserStatusBadge({ user }) {
  return (
    <span className={`status-pulse inline-flex h-6 items-center rounded-full border px-2.5 text-xs ${accountTone(user)}`}>
      {accountStatus(user)}
    </span>
  );
}

function TrustedBadge() {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-primary/24 bg-primary/10 px-2.5 text-xs text-primary">
      Trusted
    </span>
  );
}

function userActionItems({ user, onManage, onPatch, onDelete }) {
  const docId = userDocumentId(user);
  const grantUntil = () => Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  return [
    { label: "Manage", onSelect: onManage },
    user.isBlocked
      ? { label: "Unblock", onSelect: () => onPatch(docId, { isBlocked: false }) }
      : { label: "Block", onSelect: () => onPatch(docId, { isBlocked: true }) },
    { label: "Grant Unlimited", onSelect: () => onPatch(docId, { unlimitedUntil: grantUntil() }) },
    user.trustedUser
      ? { label: "Remove Trusted", onSelect: () => onPatch(docId, { trustedUser: false, trustedUntil: null }) }
      : { label: "Trusted User", onSelect: () => onPatch(docId, { trustedUser: true, trustedUntil: null }) },
    { label: "Delete", danger: true, onSelect: onDelete }
  ];
}

function UserDetailsDrawer({ user, globalDailyLimit, featureSettings, userStats, activities, onClose, onPatch, onDelete }) {
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    setTab("overview");
  }, [user?.id]);

  useEffect(() => {
    if (!featureSettings.enableMyStatistics && tab === "stats") {
      setTab("overview");
    }
  }, [featureSettings.enableMyStatistics, tab]);

  if (!user) {
    return null;
  }

  const docId = userDocumentId(user);
  const userActivities = activities
    .filter((activity) => String(activity.userId || activity.user?.telegramId || "") === String(user.telegramId || docId))
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
    .slice(0, 10);
  const successful = userActivities.filter((activity) => normalizeActivityStatus(activity.status) === "success").length;
  const successRate = userActivities.length ? Math.round((successful / userActivities.length) * 100) : 0;
  const statsTotal = Number(userStats?.totalSearches || userActivities.length);
  const statsSuccess = Number(userStats?.successfulSearches || successful);
  const statsSuccessRate = statsTotal ? Math.round((statsSuccess / statsTotal) * 100) : successRate;
  const tabs = [
    ["overview", "Overview"],
    featureSettings.enableMyStatistics ? ["stats", "Stats"] : null,
    ["activity", "Activity"],
    ["permissions", "Permissions"]
  ].filter(Boolean);

  return (
    <Drawer
      open={Boolean(user)}
      eyebrow="User details"
      title={userDisplayName(user)}
      description={`@${user.username || "no_username"} / ${docId}`}
      widthClass="max-w-2xl"
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="flex rounded-md border border-line bg-ink/24 p-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded px-3 py-2 text-sm transition duration-200 hover:text-primary ${
                tab === id ? "bg-primary/12 text-primary" : "text-text/58"
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <section className="grid gap-3 sm:grid-cols-2">
            <DetailStat label="Telegram ID" value={user.telegramId || docId} icon={UserRound} />
            <DetailStat label="Username" value={user.username ? `@${user.username}` : "No username"} />
            <DetailStat label="Display name" value={userDisplayName(user)} />
            <DetailStat label="Account status" value={accountStatus(user)} icon={user.isBlocked ? ShieldOff : Shield} />
            <DetailStat label="Trusted status" value={isTrustedActive(user) ? "Trusted" : "Not trusted"} icon={BadgeCheck} />
            <DetailStat label="Last activity" value={formatDate(user.lastSeenAt)} icon={CalendarClock} />
            {featureSettings.enableMyUsage ? (
              <>
                <DetailStat label="Daily usage" value={dailyUsageLabel(user, globalDailyLimit)} icon={CheckCircle2} />
                <DetailStat label="Remaining" value={remainingUsageLabel(user, globalDailyLimit)} />
                <DetailStat label="Daily limit" value={dailyLimitValue(user, globalDailyLimit)} />
                <DetailStat label="Override limit" value={user.dailyLimitOverride ?? "Global"} />
                <DetailStat label="Unlimited until" value={formatDate(user.unlimitedUntil)} />
              </>
            ) : null}
            <DetailStat label="Trusted until" value={formatDate(user.trustedUntil) || "No expiry"} />
          </section>
        ) : null}

        {tab === "stats" && featureSettings.enableMyStatistics ? (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailStat label="Total searches" value={statsTotal} />
              <DetailStat label="Success rate" value={`${statsSuccessRate}%`} />
              <DetailStat label="Successful" value={userStats?.successfulSearches ?? successful} />
              <DetailStat label="Rejected" value={userStats?.rejectedSearches ?? 0} />
              <DetailStat label="Failed" value={userStats?.failedSearches ?? 0} />
              <DetailStat label="Average similarity" value={`${userStats?.averageSimilarity ?? 0}%`} />
              <DetailStat label="Most searched anime" value={userStats?.topAnime?.animeTitle || "Not enough data"} />
            </div>
          </section>
        ) : null}

        {tab === "activity" ? (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailStat label="Recent analyses" value={userActivities.length} />
              <DetailStat label="Success rate" value={`${successRate}%`} />
            </div>
            <div className="rounded-lg border border-line bg-ink/24">
              <div className="border-b border-line px-4 py-3">
                <h3 className="font-medium text-text">Recent Analyses</h3>
              </div>
              {userActivities.length === 0 ? (
                <p className="px-4 py-5 text-sm text-text/52">No recent analyses for this user in the current activity window.</p>
              ) : (
                <div className="divide-y divide-line">
                  {userActivities.map((activity) => (
                    <div key={activity.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{activity.animeTitle || activity.botResponse?.title || "No match"}</p>
                        <p className="text-xs text-text/46">{formatDate(activity.createdAt)}</p>
                      </div>
                      <StatusPill status={normalizeActivityStatus(activity.status)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "permissions" ? (
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-text/42">Override limit</span>
                <input
                  key={`${docId}-limit-${user.dailyLimitOverride ?? "global"}`}
                  className={`${inputClass} mt-2`}
                  type="number"
                  min="0"
                  defaultValue={user.dailyLimitOverride ?? ""}
                  placeholder="global limit"
                  onBlur={(event) =>
                    onPatch(docId, {
                      dailyLimitOverride: event.target.value === "" ? null : Number(event.target.value)
                    })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-text/42">Unlimited access</span>
                <input
                  key={`${docId}-unlimited-${toDatetimeLocal(user.unlimitedUntil)}`}
                  className={`${inputClass} mt-2`}
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(user.unlimitedUntil)}
                  onBlur={(event) =>
                    onPatch(docId, {
                      unlimitedUntil: event.target.value ? Timestamp.fromDate(new Date(event.target.value)) : null
                    })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-text/42">Trusted until</span>
                <input
                  key={`${docId}-trusted-${toDatetimeLocal(user.trustedUntil)}`}
                  className={`${inputClass} mt-2`}
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(user.trustedUntil)}
                  onBlur={(event) =>
                    onPatch(docId, {
                      trustedUntil: event.target.value ? Timestamp.fromDate(new Date(event.target.value)) : null
                    })
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-ink/24 px-3 py-3 text-sm text-text/76">
                <span>Trusted User</span>
                <input type="checkbox" checked={Boolean(user.trustedUser)} onChange={(event) => onPatch(docId, { trustedUser: event.target.checked })} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-ink/24 px-3 py-3 text-sm text-text/76">
                <span>Block status</span>
                <input type="checkbox" checked={Boolean(user.isBlocked)} onChange={(event) => onPatch(docId, { isBlocked: event.target.checked })} />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} type="button" onClick={() => onPatch(docId, { unlimitedUntil: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) })}>
                Grant Unlimited
              </button>
              <button className={buttonClass} type="button" onClick={() => onPatch(docId, { unlimitedUntil: null })}>
                Clear Unlimited
              </button>
              <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={() => onDelete([docId])}>
                <Trash2 className="h-4 w-4" />
                Delete User
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}

function UserCard({ user, globalDailyLimit, featureSettings, selectMode, selected, onSelect, onManage, onPatch, onDelete }) {
  const docId = userDocumentId(user);

  return (
    <article className="interactive-card flex min-h-56 flex-col rounded-lg border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <label className="flex min-w-0 items-start gap-3">
          {selectMode ? (
            <input
              className="mt-1"
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelect(event.target.checked)}
              aria-label={`Select ${user.username || user.telegramId}`}
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-text">{userDisplayName(user)}</p>
            <p className="mt-1 truncate text-sm text-text/52">@{user.username || "no_username"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <UserStatusBadge user={user} />
              {isTrustedActive(user) ? <TrustedBadge /> : null}
            </div>
          </div>
        </label>
        <ActionMenu
          items={userActionItems({
            user,
            onManage,
            onPatch,
            onDelete: () => onDelete([docId])
          })}
        />
      </div>

      <div className="mt-5 grid gap-3 text-sm text-text/70">
        {featureSettings.enableMyUsage ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-text/42">Daily usage</span>
              <span className="text-text">{dailyUsageLabel(user, globalDailyLimit)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-text/42">Remaining</span>
              <span className="text-text">{remainingUsageLabel(user, globalDailyLimit)}</span>
            </div>
          </>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-text/42">Trusted</span>
          <span className="text-text">{isTrustedActive(user) ? "Enabled" : "No"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-text/42">Last activity</span>
          <span className="text-right text-text">{formatDate(user.lastSeenAt)}</span>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <button className={`${buttonClass} w-full`} type="button" onClick={onManage}>
          Manage
        </button>
      </div>
    </article>
  );
}

export function Users() {
  const users = useFirestoreCollection(query(collection(db, "users"), orderBy("lastSeenAt", "desc"), limit(300)), []);
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(500)), []);
  const userStats = useFirestoreCollection(query(collection(db, "userStats"), limit(500)), []);
  const [search, setSearch] = useState("");
  const [globalDailyLimit, setGlobalDailyLimit] = useState(5);
  const [featureSettings, setFeatureSettings] = useState(defaultFeatureSettings);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "global"), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      const dailyLimit = data.dailyLimit;
      setGlobalDailyLimit(dailyLimit !== null && dailyLimit !== undefined && Number.isFinite(Number(dailyLimit)) ? Number(dailyLimit) : 5);
      setFeatureSettings({
        ...defaultFeatureSettings,
        ...data
      });
    });
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return users.data;
    }

    return users.data.filter((user) =>
      [user.telegramId, user.username, user.firstName, user.lastName, accountStatus(user)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [search, users.data]);
  const visibleUserIds = useMemo(() => filtered.map(userDocumentId).filter(Boolean), [filtered]);

  useEffect(() => {
    if (!selectMode) {
      return;
    }

    const visibleIds = new Set(visibleUserIds);
    setSelectedUserIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [selectMode, visibleUserIds]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }

    return users.data.find((user) => userDocumentId(user) === selectedUserId) || null;
  }, [selectedUserId, users.data]);
  const userStatsById = useMemo(() => new Map(userStats.data.map((stats) => [String(stats.id || stats.userId), stats])), [userStats.data]);
  const selectedUserStats = selectedUser ? userStatsById.get(userDocumentId(selectedUser)) || null : null;

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
      setSelectedUserId((current) => current && deleteRequest.ids.includes(current) ? null : current);
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

  const loadError = users.error || userStats.error;

  if (loadError) {
    return <EmptyState title="Could not load users" detail={loadError} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Users</h1>
          <p className="text-sm text-text/54">Limits, blocks, trusted status, and unlimited access.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {!selectMode ? (
            <button className={buttonClass} type="button" onClick={() => setSelectMode(true)}>
              Select
            </button>
          ) : null}
          <input className={`${inputClass} sm:max-w-xs`} placeholder="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {selectMode ? (
        <SelectionToolbar
          selectedCount={selectedUserIds.length}
          totalVisibleCount={visibleUserIds.length}
          onSelectAll={() => setSelectedUserIds(visibleUserIds)}
          onClear={() => setSelectedUserIds([])}
          onDeleteSelected={() => requestDelete(selectedUserIds)}
          onCancel={cancelSelection}
          isDeleting={deleting}
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
          {filtered.map((user) => {
            const docId = userDocumentId(user);

            return (
              <UserCard
                key={user.id}
                user={user}
                globalDailyLimit={globalDailyLimit}
                featureSettings={featureSettings}
                selectMode={selectMode}
                selected={selectedUserIds.includes(docId)}
                onSelect={(checked) => toggleSelected(docId, checked)}
                onManage={() => setSelectedUserId(docId)}
                onPatch={patchUser}
                onDelete={requestDelete}
              />
            );
          })}
        </div>
      )}

      <UserDetailsDrawer
        user={selectedUser}
        globalDailyLimit={globalDailyLimit}
        featureSettings={featureSettings}
        userStats={selectedUserStats}
        activities={activities.data}
        onClose={() => setSelectedUserId(null)}
        onPatch={patchUser}
        onDelete={requestDelete}
      />

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
