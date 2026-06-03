import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { CheckCircle2, Eye, Trash2, XCircle } from "lucide-react";
import { db } from "../firebase.js";
import { ActionMenu } from "../components/ActionMenu.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Drawer } from "../components/Drawer.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { normalizeActivityStatus } from "../utils/activityTypes.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
}

function reportId(report) {
  return report.id || report.reportId;
}

function reportStatus(report) {
  return report.status || "open";
}

function activityTitle(activity = {}) {
  return activity.animeTitle || activity.botResponse?.title || "Unknown anime";
}

function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-text/38">{label}</p>
      <p className="mt-1 break-all text-sm text-text/76">{value}</p>
    </div>
  );
}

function ReportDrawer({ report, activity, onClose, onResolve, onIgnore, onDelete }) {
  if (!report) {
    return null;
  }

  return (
    <Drawer
      open={Boolean(report)}
      eyebrow="Wrong match report"
      title={report.animeTitle || "Reported match"}
      description={`${reportStatus(report)} / ${formatDate(report.createdAt)}`}
      widthClass="max-w-2xl"
      onClose={onClose}
      footer={(
        <div className="flex flex-wrap gap-2">
          <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={() => onResolve(report)}>
            <CheckCircle2 className="h-4 w-4" />
            Mark resolved
          </button>
          <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={() => onIgnore(report)}>
            <XCircle className="h-4 w-4" />
            Mark ignored
          </button>
          <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={() => onDelete([report])}>
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Report ID" value={reportId(report)} />
          <DetailRow label="Activity ID" value={report.activityId} />
          <DetailRow label="User" value={report.displayName || report.username || report.telegramId || report.userId} />
          <DetailRow label="Reason" value={report.reason || "Not provided"} />
          <DetailRow label="Similarity" value={report.similarity !== null && report.similarity !== undefined ? `${report.similarity}%` : null} />
          <DetailRow label="Time" value={report.formattedTime} />
          <DetailRow label="Episode" value={report.episode} />
          <DetailRow label="AniList" value={report.anilistUrl || report.anilistId} />
        </section>

        <section className="rounded-lg border border-line bg-ink/24 p-4">
          <h3 className="font-medium text-text">Linked Activity</h3>
          {activity ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailRow label="Title" value={activityTitle(activity)} />
              <DetailRow label="Status" value={normalizeActivityStatus(activity.status)} />
              <DetailRow label="Source" value={activity.inputType || activity.source} />
              <DetailRow label="Created" value={formatDate(activity.createdAt)} />
              <DetailRow label="Input URL" value={activity.inputUrl} />
              <DetailRow label="Error/reason" value={activity.error || activity.rejectionReason} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-text/54">The linked activity is outside the current activity window or was deleted.</p>
          )}
        </section>

        <details className="rounded-lg border border-line bg-ink/24">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text/70">Developer payload</summary>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all px-4 pb-4 text-xs text-text/58">
            {JSON.stringify(report, null, 2)}
          </pre>
        </details>
      </div>
    </Drawer>
  );
}

function ReportCard({ report, activity, onOpen, onResolve, onIgnore, onDelete }) {
  return (
    <article className="rounded-lg border border-line bg-panel p-4 transition hover:border-primary/50">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={reportStatus(report)} />
            {report.reason ? <span className="rounded-full border border-line px-2 py-1 text-xs text-text/58">{report.reason}</span> : null}
          </div>
          <h2 className="mt-3 truncate text-lg font-semibold text-text">{report.animeTitle || activityTitle(activity)}</h2>
          <p className="mt-1 text-xs text-text/46">{report.displayName || report.username || report.telegramId || report.userId} / {formatDate(report.createdAt)}</p>
        </div>
        <ActionMenu
          items={[
            { label: "Open linked activity", onSelect: onOpen },
            { label: "Mark resolved", onSelect: () => onResolve(report) },
            { label: "Mark ignored", onSelect: () => onIgnore(report) },
            { label: "Delete", danger: true, onSelect: () => onDelete([report]) }
          ]}
        />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <DetailRow label="Activity" value={report.activityId} />
        <DetailRow label="Similarity" value={report.similarity !== null && report.similarity !== undefined ? `${report.similarity}%` : null} />
        <DetailRow label="Time" value={report.formattedTime} />
        <DetailRow label="Status" value={reportStatus(report)} />
      </dl>

      <button className={`${buttonClass} mt-4 inline-flex items-center gap-2`} type="button" onClick={onOpen}>
        <Eye className="h-4 w-4" />
        Open report
      </button>
    </article>
  );
}

export function WrongMatchReports() {
  const reports = useFirestoreCollection(query(collection(db, "wrongMatchReports"), orderBy("createdAt", "desc"), limit(300)), []);
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(500)), []);
  const [status, setStatus] = useState("open");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const activityById = useMemo(() => new Map(activities.data.map((activity) => [activity.id, activity])), [activities.data]);
  const filtered = useMemo(() => {
    if (status === "all") {
      return reports.data;
    }

    return reports.data.filter((report) => reportStatus(report) === status);
  }, [reports.data, status]);
  const selectedReport = reports.data.find((report) => reportId(report) === selectedReportId) || null;
  const selectedActivity = selectedReport ? activityById.get(selectedReport.activityId) || null : null;

  async function setReportStatus(report, nextStatus) {
    await updateDoc(doc(db, "wrongMatchReports", reportId(report)), {
      status: nextStatus,
      resolvedAt: serverTimestamp(),
      resolvedBy: "dashboard-admin",
      updatedAt: serverTimestamp()
    });
  }

  function requestDelete(records) {
    setDeleteError("");
    setDeleteRequest({
      records,
      title: records.length === 1 ? "Delete Report?" : "Delete Reports?",
      message: "This action cannot be undone."
    });
  }

  async function confirmDelete() {
    if (!deleteRequest?.records?.length) {
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await Promise.all(deleteRequest.records.map((report) => deleteDoc(doc(db, "wrongMatchReports", reportId(report)))));
      setSelectedReportId((current) =>
        current && deleteRequest.records.some((report) => reportId(report) === current) ? null : current
      );
      setDeleteRequest(null);
    } catch (error) {
      setDeleteError(error.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const loadError = reports.error || activities.error;

  if (loadError) {
    return <EmptyState title="Could not load wrong match reports" detail={loadError} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Wrong Match Reports</h1>
          <p className="text-sm text-text/54">User-submitted reports linked back to activity records.</p>
        </div>
        <select className={`${inputClass} sm:max-w-xs`} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
          <option value="all">All statuses</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No wrong match reports found" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((report) => (
            <ReportCard
              key={reportId(report)}
              report={report}
              activity={activityById.get(report.activityId)}
              onOpen={() => setSelectedReportId(reportId(report))}
              onResolve={(currentReport) => setReportStatus(currentReport, "resolved")}
              onIgnore={(currentReport) => setReportStatus(currentReport, "ignored")}
              onDelete={requestDelete}
            />
          ))}
        </div>
      )}

      <ReportDrawer
        report={selectedReport}
        activity={selectedActivity}
        onClose={() => setSelectedReportId(null)}
        onResolve={(report) => setReportStatus(report, "resolved")}
        onIgnore={(report) => setReportStatus(report, "ignored")}
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
