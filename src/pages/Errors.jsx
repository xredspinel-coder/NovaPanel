import { useMemo, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { Trash2 } from "lucide-react";
import { db } from "../firebase.js";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { ImageLightbox } from "../components/ImageLightbox.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { failureLabel, isTechnicalFailure, normalizeActivityStatus } from "../utils/activityTypes.js";
import { deleteFirestoreDocument } from "../utils/firestoreDelete.js";

const SOURCE_COLLECTIONS = {
  errors: "errors",
  activities: "activities"
};

const SOURCE_LABELS = {
  errors: "Errors collection",
  activities: "Activities collection"
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

  return 0;
}

function errorRecord(error) {
  return {
    ...error,
    key: `errors:${error.id}`,
    sourceCollection: SOURCE_COLLECTIONS.errors,
    recordType: "Error",
    failureType: failureLabel(error),
    status: error.status || "failed",
    message: error.message || "Unknown error"
  };
}

function activityFailureRecord(activity) {
  return {
    ...activity,
    key: `activities:${activity.id}`,
    sourceCollection: SOURCE_COLLECTIONS.activities,
    recordType: "Activity failure",
    failureType: failureLabel(activity),
    status: normalizeActivityStatus(activity.status),
    message: activity.error || activity.botResponse?.message || activity.rejectionReason || "Technical failure"
  };
}

function inputUrl(record) {
  return record.inputUrl || record.userInput?.url || record.userInput?.inputUrl || "";
}

function isPreviewImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);

    if (["blob:", "data:"].includes(parsed.protocol)) {
      return true;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    return (
      /^https:\/\/api\.telegram\.org\/file\//i.test(parsed.href) ||
      /^https:\/\/api\.trace\.moe\/image\//i.test(parsed.href) ||
      /\.(?:avif|gif|jpe?g|png|webp)$/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function errorPreviewImageUrl(record = {}) {
  const media = record.media && typeof record.media === "object" ? record.media : {};
  const botResponse = record.botResponse && typeof record.botResponse === "object" ? record.botResponse : {};

  return [
    media.inputTelegramFileUrl,
    record.inputTelegramFileUrl,
    media.inputImageUrl,
    record.inputImageUrl,
    record.inputPreview,
    record.inputThumbnail,
    media.resultImageUrl,
    record.resultImageUrl,
    record.imageUrl,
    botResponse.imageUrl,
    inputUrl(record)
  ].find(isPreviewImageUrl) || "";
}

function sourceLabel(sourceCollection) {
  return SOURCE_LABELS[sourceCollection] || sourceCollection || "Unknown source";
}

function deleteTarget(record) {
  const sourceCollection = record.sourceCollection;

  if (!Object.values(SOURCE_COLLECTIONS).includes(sourceCollection)) {
    throw new Error(`Unsupported error source: ${sourceCollection || "unknown"}`);
  }

  if (!record.id) {
    throw new Error(`Cannot delete ${sourceCollection} error without a document ID.`);
  }

  return {
    sourceCollection,
    documentId: record.id,
    deletePath: `${sourceCollection}/${record.id}`
  };
}

function ErrorCard({ error, selectMode, selected, onSelect, onDelete, onOpenImage }) {
  const url = inputUrl(error);
  const previewUrl = errorPreviewImageUrl(error);

  return (
    <article className="flex h-full min-w-0 flex-col rounded-lg border border-line bg-panel/92 p-4 text-text/72 backdrop-blur transition hover:border-primary/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={error.status} />
            <span className="rounded-full border border-line px-2 py-1 text-xs text-text/58">{error.failureType || "unknown"}</span>
            <span className="rounded-full border border-primary/24 bg-primary/10 px-2 py-1 text-xs text-primary">
              {sourceLabel(error.sourceCollection)}
            </span>
          </div>
          <h2 className="mt-3 line-clamp-2 text-base font-semibold text-text">{error.message}</h2>
          <p className="mt-1 text-xs text-text/46">{error.recordType} / {formatDate(error.createdAt)}</p>
        </div>

        {selectMode ? (
          <label className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-text/72">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelect(event.target.checked)}
              aria-label={`Select error ${error.id}`}
            />
            Select
          </label>
        ) : null}
      </div>

      <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-[0.16em] text-text/38">User</dt>
          <dd className="mt-1 truncate text-text/72" title={error.userId || ""}>{error.userId || "-"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-[0.16em] text-text/38">Source</dt>
          <dd className="mt-1 truncate text-text/72" title={error.source || ""}>{error.source || "-"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-[0.16em] text-text/38">Document</dt>
          <dd className="mt-1 truncate font-mono text-xs text-text/62" title={`${error.sourceCollection}/${error.id}`}>
            {error.sourceCollection}/{error.id}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-[0.16em] text-text/38">Input URL</dt>
          {url ? (
            <dd className="mt-1">
              <a className="block truncate text-primary hover:text-text" href={url} target="_blank" rel="noreferrer" title={url}>
                {url}
              </a>
            </dd>
          ) : (
            <dd className="mt-1 text-text/46">-</dd>
          )}
        </div>
      </dl>

      {previewUrl ? (
        <button
          type="button"
          className="mt-4 block w-full cursor-zoom-in overflow-hidden rounded-lg border border-line bg-ink/24 text-left"
          onClick={() => onOpenImage({ src: previewUrl, alt: error.message || "Error preview" })}
          aria-label="Open error image preview"
        >
          <img className="block aspect-video w-full object-cover" src={previewUrl} alt="Error preview" />
        </button>
      ) : null}

      {url ? (
        <details className="mt-3 min-w-0 rounded-md border border-line bg-ink/24 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-text/58 transition hover:text-primary">Full URL</summary>
          <a className="mt-2 block break-all text-sm text-primary hover:text-text" href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </details>
      ) : null}

      <div className="mt-auto flex justify-end pt-4">
        <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </article>
  );
}

export function Errors() {
  const errors = useFirestoreCollection(query(collection(db, "errors"), orderBy("createdAt", "desc"), limit(300)), []);
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(300)), []);
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedErrorKeys, setSelectedErrorKeys] = useState([]);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [lightboxImage, setLightboxImage] = useState(null);

  const combined = useMemo(() => {
    const nativeErrors = errors.data.map(errorRecord);
    const routedActivityFailures = activities.data.filter(isTechnicalFailure).map(activityFailureRecord);

    return [...nativeErrors, ...routedActivityFailures].sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
  }, [activities.data, errors.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return combined;
    }

    return combined.filter((error) =>
      [error.message, error.userId, error.source, inputUrl(error), error.failureType, error.recordType, error.sourceCollection]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [combined, search]);

  function toggleSelected(errorKey, checked) {
    setSelectedErrorKeys((current) =>
      checked ? [...new Set([...current, errorKey])] : current.filter((key) => key !== errorKey)
    );
  }

  function requestDelete(records) {
    setDeleteError("");
    setDeleteRequest({
      records,
      title: records.length === 1 ? "Delete Error?" : "Delete Selected Errors?",
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
      const targets = deleteRequest.records.map(deleteTarget);
      await Promise.all(targets.map((target) =>
        deleteFirestoreDocument(db, target.sourceCollection, target.documentId, { source: "errors page delete" })
      ));
      setSelectedErrorKeys([]);
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
    setSelectedErrorKeys([]);
  }

  const selectedRecords = combined.filter((record) => selectedErrorKeys.includes(record.key));
  const loadError = errors.error || activities.error;

  if (loadError) {
    return <EmptyState title="Could not load errors" detail={loadError} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Errors</h1>
          <p className="text-sm text-text/54">System, media, and source failures from bot processing.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {selectMode ? (
            <>
              <span className="rounded-md border border-line px-3 py-2 text-sm text-text/62">{selectedRecords.length} selected</span>
              {selectedRecords.length > 0 ? (
                <button className={buttonClass} type="button" onClick={() => requestDelete(selectedRecords)}>
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
          <input className={`${inputClass} sm:max-w-xs`} placeholder="Search errors" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={combined.length === 0 ? "No errors logged" : "No errors found"} />
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {filtered.map((error) => (
            <ErrorCard
              key={error.key}
              error={error}
              selectMode={selectMode}
              selected={selectedErrorKeys.includes(error.key)}
              onSelect={(checked) => toggleSelected(error.key, checked)}
              onDelete={() => requestDelete([error])}
              onOpenImage={setLightboxImage}
            />
          ))}
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
      <ImageLightbox
        src={lightboxImage?.src}
        alt={lightboxImage?.alt}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
