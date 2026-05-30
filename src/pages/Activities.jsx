import { useEffect, useMemo, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import ReactPlayer from "react-player";
import { Download, ExternalLink, Grid2X2, List, PlayCircle, X } from "lucide-react";
import { db } from "../firebase.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { usePersistentState } from "../hooks/usePersistentState.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
}

function normalizeStatus(status) {
  if (status === "low_similarity") {
    return "rejected";
  }

  if (status === "error") {
    return "failed";
  }

  return status || "unknown";
}

function displayUser(activity) {
  const user = activity.user || {};
  return {
    username: user.username || null,
    displayName: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || activity.userId,
    telegramId: user.telegramId || activity.userId
  };
}

function resolveActivityMedia(activity = {}) {
  const inputImage =
    activity.media?.inputImageUrl ||
    activity.media?.inputTelegramFileUrl ||
    activity.inputPreview ||
    activity.inputThumbnail ||
    activity.inputUrl ||
    null;

  const resultImage =
    activity.media?.resultImageUrl ||
    activity.media?.botImageUrl ||
    activity.imageUrl ||
    null;

  const resultVideo =
    activity.media?.resultVideoUrl ||
    activity.media?.botVideoUrl ||
    activity.videoUrl ||
    null;

  return {
    inputImage,
    resultImage,
    resultVideo
  };
}

function previewUrl(activity) {
  const media = resolveActivityMedia(activity);
  return media.inputImage || media.resultImage || null;
}

function DetailRow({ label, value, href }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-text/38">{label}</p>
      {href ? (
        <a className="mt-1 block break-all text-sm text-primary hover:text-text" href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <p className="mt-1 break-all text-sm text-text/78">{value}</p>
      )}
    </div>
  );
}

function MediaImage({ label, src, alt }) {
  if (!src) {
    return null;
  }

  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-text/38">{label}</p>
      <img className="aspect-video w-full rounded-lg border border-line object-cover" src={src} alt={alt} />
    </div>
  );
}

function VideoPreview({ src }) {
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [src]);

  if (!src) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.16em] text-text/38">Video preview</p>
      <div className="overflow-hidden rounded-lg border border-line bg-black">
        <div className="aspect-video">
          {videoFailed ? (
            <div className="grid h-full place-items-center px-4 text-center text-sm text-text/58">
              <span>
                Video preview could not load here.{" "}
                <a className="text-primary hover:text-text" href={src} target="_blank" rel="noreferrer">
                  Open video
                </a>
              </span>
            </div>
          ) : (
            <ReactPlayer
              src={src}
              controls
              playing={false}
              muted={false}
              width="100%"
              height="100%"
              onError={() => setVideoFailed(true)}
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className={`${buttonClass} inline-flex items-center gap-2`} href={src} target="_blank" rel="noreferrer" download>
          <Download className="h-4 w-4" />
          Download video
        </a>
        <a className={`${buttonClass} inline-flex items-center gap-2`} href={src} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" />
          Open video
        </a>
      </div>
    </div>
  );
}

function ActivityDetails({ activity, onClose }) {
  if (!activity) {
    return null;
  }

  const user = displayUser(activity);
  const botResponse = activity.botResponse || {};
  const media = resolveActivityMedia(activity);
  const similarity = botResponse.similarity ?? activity.similarity;

  return (
    <div className="fixed inset-0 z-40 bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <section className="ml-auto flex h-full max-w-xl flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Activity details</p>
            <h2 className="mt-1 text-xl font-semibold text-text">{activity.animeTitle || botResponse.title || "Unresolved activity"}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-md border border-line text-text/62 transition hover:text-primary" type="button" onClick={onClose} aria-label="Close details">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-6 overflow-y-auto p-5">
          <MediaImage label="User input preview" src={media.inputImage} alt="User input preview" />
          <MediaImage label="Bot/result image preview" src={media.resultImage} alt="Bot result preview" />
          <VideoPreview src={media.resultVideo} />

          <section className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Status" value={normalizeStatus(activity.status)} />
            <DetailRow label="Reason" value={activity.rejectionReason || activity.error} />
            <DetailRow label="Source type" value={activity.inputType || activity.source} />
            <DetailRow label="Created" value={formatDate(activity.createdAt)} />
          </section>

          <section className="space-y-3 rounded-lg border border-line bg-ink/24 p-4">
            <h3 className="font-medium text-text">User Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Display name" value={user.displayName} />
              <DetailRow label="Username" value={user.username ? `@${user.username}` : null} />
              <DetailRow label="Telegram ID" value={user.telegramId} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-line bg-ink/24 p-4">
            <h3 className="font-medium text-text">User Input</h3>
            <div className="grid gap-4">
              <DetailRow label="Input URL" value={activity.inputUrl} href={activity.inputUrl} />
              <DetailRow label="Input file ID" value={activity.inputFileId} />
              <DetailRow label="Message text" value={activity.userInput?.text} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-line bg-ink/24 p-4">
            <h3 className="font-medium text-text">Bot Output</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Anime title" value={botResponse.title || activity.animeTitle} />
              <DetailRow label="Episode" value={botResponse.episode ?? activity.episode} />
              <DetailRow label="Similarity" value={similarity !== null && similarity !== undefined ? `${similarity}%` : null} />
              <DetailRow label="Time range" value={botResponse.time || activity.formattedTime} />
              <DetailRow label="AniList" value={activity.anilistUrl ? "Open AniList" : null} href={activity.anilistUrl} />
              <DetailRow label="Message" value={botResponse.message} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ViewToggle({ viewMode, setViewMode }) {
  return (
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
  );
}

export function Activities() {
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(300)), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [viewMode, setViewMode] = usePersistentState("novapanel-activities-view", "grid");
  const [selectedActivity, setSelectedActivity] = useState(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activities.data.filter((activity) => {
      const normalizedStatus = normalizeStatus(activity.status);
      const matchesStatus = status === "all" || normalizedStatus === status;
      const matchesSearch =
        !needle ||
        [
          activity.animeTitle,
          activity.botResponse?.title,
          activity.userId,
          activity.user?.username,
          activity.user?.displayName,
          activity.source,
          activity.inputType,
          activity.rejectionReason,
          activity.anilistId
        ]
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
          <h1 className="text-2xl font-semibold text-text">Activities</h1>
          <p className="text-sm text-text/54">What users submitted and what NovaPanel returned.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className={inputClass} placeholder="Search activity" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No activities found" />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((activity) => {
            const image = previewUrl(activity);
            const media = resolveActivityMedia(activity);
            const user = displayUser(activity);

            return (
              <button key={activity.id} type="button" onClick={() => setSelectedActivity(activity)} className="overflow-hidden rounded-lg border border-line bg-panel text-left transition hover:border-primary">
                <div className="relative">
                  {image ? (
                    <img className="aspect-video w-full object-cover" src={image} alt="Activity preview" />
                  ) : (
                    <div className="grid aspect-video place-items-center bg-ink/28 text-sm text-text/42">No preview</div>
                  )}
                  {media.resultVideo ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-ink/80 px-2 py-1 text-xs font-medium text-primary backdrop-blur">
                      <PlayCircle className="h-3.5 w-3.5 fill-current" />
                      Video
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatusPill status={normalizeStatus(activity.status)} />
                    <span className="text-xs text-text/46">{formatDate(activity.createdAt)}</span>
                  </div>
                  <div>
                    <p className="line-clamp-1 font-medium text-text">{activity.animeTitle || activity.botResponse?.title || "No match"}</p>
                    <p className="mt-1 text-xs text-text/50">{user.displayName} / {activity.inputType || activity.source || "unknown"}</p>
                  </div>
                  <p className="text-sm text-text/62">
                    {activity.formattedTime || activity.botResponse?.time || activity.rejectionReason || activity.error || "Open details"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel backdrop-blur">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-text/42">
              <tr>
                <th className="px-4 py-3">Anime</th>
                <th>Status</th>
                <th>Reason</th>
                <th>User</th>
                <th>Input</th>
                <th>Similarity</th>
                <th>Links</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((activity) => {
                const user = displayUser(activity);
                const media = resolveActivityMedia(activity);

                return (
                  <tr key={activity.id} className="cursor-pointer text-text/72 transition hover:bg-ink/20" onClick={() => setSelectedActivity(activity)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{activity.animeTitle || activity.botResponse?.title || "No match"}</p>
                      <p className="text-xs text-text/46">{activity.formattedTime || activity.botResponse?.time || "-"}</p>
                    </td>
                    <td><StatusPill status={normalizeStatus(activity.status)} /></td>
                    <td>{activity.rejectionReason || activity.error || "-"}</td>
                    <td>{user.displayName}</td>
                    <td>{activity.inputType || activity.source || "-"}</td>
                    <td>{activity.similarity ?? "-"}%</td>
                    <td>
                      <div className="flex gap-3">
                        {activity.anilistUrl ? <a className="text-primary hover:text-text" href={activity.anilistUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>AniList</a> : null}
                        {media.resultVideo ? (
                          <a className="inline-flex items-center gap-1 text-primary hover:text-text" href={media.resultVideo} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                            <PlayCircle className="h-3.5 w-3.5 fill-current" />
                            Video
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td>{formatDate(activity.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ActivityDetails activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
    </div>
  );
}
