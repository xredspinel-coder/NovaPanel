import { useEffect, useMemo, useRef, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { Download, ExternalLink, Grid2X2, ImageOff, List, PlayCircle, Trash2, X } from "lucide-react";
import { db } from "../firebase.js";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { failureLabel, isTechnicalFailure, normalizeActivityStatus } from "../utils/activityTypes.js";
import { downloadFile } from "../utils/downloadFile.js";
import { deleteFirestoreDocument } from "../utils/firestoreDelete.js";
import { addDeveloperConsoleEntry } from "../utils/developerConsole.js";
import { canResolveTelegramFiles, resolveTelegramFileUrl, uniqueStrings } from "../utils/mediaResolver.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
}

function displayUser(activity) {
  const user = activity.user || {};
  return {
    username: user.username || null,
    displayName: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || activity.userId,
    telegramId: user.telegramId || activity.userId
  };
}

const MEDIA_SOURCE_LABELS = {
  telegram: "Telegram media",
  trace: "trace.moe fallback",
  input: "input image",
  unavailable: "unavailable"
};

function isTraceMoeUrl(url) {
  return /^https:\/\/api\.trace\.moe\//i.test(url);
}

function mediaSource(url, kind) {
  const [normalized] = uniqueStrings([url]);

  if (!normalized) {
    return null;
  }

  return {
    url: normalized,
    kind: kind || (isTraceMoeUrl(normalized) ? "trace" : "input")
  };
}

function uniqueMediaSources(sources) {
  const seen = new Set();

  return sources.filter(Boolean).filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }

    seen.add(source.url);
    return true;
  });
}

function mediaSourceList(entries) {
  return uniqueMediaSources(entries.map(([url, kind]) => mediaSource(url, kind)));
}

function mediaSourceLabel(source) {
  return MEDIA_SOURCE_LABELS[source?.kind] || MEDIA_SOURCE_LABELS.unavailable;
}

function resolvedSourceLabel(source, { loading = false, hasTelegramFileId = false } = {}) {
  if (loading && hasTelegramFileId) {
    return "Telegram file ID resolving";
  }

  if (source?.kind === "telegram") {
    return "Telegram file ID";
  }

  if (source?.kind === "trace") {
    return "trace.moe fallback";
  }

  if (source?.kind === "input") {
    return "input image";
  }

  return MEDIA_SOURCE_LABELS.unavailable;
}

function filenameSafePart(value, fallback) {
  const cleaned = String(value || fallback || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return cleaned || fallback;
}

function startTimeLabel(value) {
  return String(value || "").split(/\s*(?:->|-)\s*/)[0].trim();
}

function videoDownloadFilename({ title, time, id }) {
  const safeTitle = filenameSafePart(title, id ? `aniseek-activity-${id}` : "aniseek-video");
  const safeTime = filenameSafePart(startTimeLabel(time), "");

  return `${safeTitle}${safeTime ? ` [${safeTime}]` : ""}.mp4`;
}

function collectMedia(activity = {}) {
  const media = activity.media && typeof activity.media === "object" ? activity.media : {};

  return {
    inputImageFileIds: uniqueStrings([
      media.inputTelegramFileId,
      activity.inputTelegramFileId,
      activity.inputFileId
    ]),
    sentPhotoFileIds: uniqueStrings([
      media.sentPhotoFileId,
      activity.sentPhotoFileId
    ]),
    videoFileIds: uniqueStrings([
      media.sentVideoFileId,
      activity.sentVideoFileId,
      media.sentAnimationFileId,
      activity.sentAnimationFileId
    ]),
    telegramVideoSources: mediaSourceList([
      [media.botVideoUrl, "telegram"],
      [activity.botVideoUrl, "telegram"]
    ]),
    inputImageFallbackSources: mediaSourceList([
      [media.inputTelegramFileUrl, "input"],
      [activity.inputTelegramFileUrl, "input"],
      [media.inputImageUrl, "input"],
      [activity.inputImageUrl, "input"],
      [activity.inputPreview, "input"],
      [activity.inputThumbnail, "input"],
      [activity.inputUrl, "input"]
    ]),
    resultImageFallbackSources: mediaSourceList([
      [media.resultImageUrl, "trace"],
      [activity.resultImageUrl, "trace"],
      [activity.imageUrl, "trace"],
      [activity.botResponse?.imageUrl, "trace"]
    ]),
    resultVideoFallbackSources: mediaSourceList([
      [media.resultVideoUrl, "trace"],
      [activity.resultVideoUrl, "trace"],
      [activity.videoUrl, "trace"],
      [activity.botResponse?.videoUrl, "trace"]
    ])
  };
}

function useResolvedTelegramSources(fileIds, kind = "telegram") {
  const key = `${kind}:${fileIds.join("|")}`;
  const [state, setState] = useState({
    sources: [],
    loading: false,
    settled: false
  });

  useEffect(() => {
    let active = true;

    if (!fileIds.length || !canResolveTelegramFiles()) {
      setState({
        sources: [],
        loading: false,
        settled: false
      });
      return () => {
        active = false;
      };
    }

    setState({
      sources: [],
      loading: true,
      settled: false
    });

    Promise.allSettled(fileIds.map((fileId) => resolveTelegramFileUrl(fileId))).then((results) => {
      if (!active) {
        return;
      }

      setState({
        sources: mediaSourceList(
          results.map((result) => [result.status === "fulfilled" ? result.value : null, kind])
        ),
        loading: false,
        settled: true
      });
    });

    return () => {
      active = false;
    };
  }, [key]);

  return state;
}

function useActivityMedia(activity) {
  const media = useMemo(() => collectMedia(activity), [activity]);
  const resolvedInputImages = useResolvedTelegramSources(media.inputImageFileIds, "input");
  const resolvedSentPhotos = useResolvedTelegramSources(media.sentPhotoFileIds, "telegram");
  const resolvedVideos = useResolvedTelegramSources(media.videoFileIds, "telegram");
  const canResolveTelegram = canResolveTelegramFiles();
  const canUseVideoFallback =
    !media.videoFileIds.length ||
    !canResolveTelegram ||
    (resolvedVideos.settled && resolvedVideos.sources.length === 0);
  const canUseSentPhotoFallback =
    !media.sentPhotoFileIds.length ||
    !canResolveTelegram ||
    (resolvedSentPhotos.settled && resolvedSentPhotos.sources.length === 0);
  const canUseInputImageFallback =
    !media.inputImageFileIds.length ||
    !canResolveTelegram ||
    (resolvedInputImages.settled && resolvedInputImages.sources.length === 0);

  const inputImageSources = uniqueMediaSources([
      ...resolvedInputImages.sources,
      ...(canUseInputImageFallback ? media.inputImageFallbackSources : [])
    ]);
  const imageSources = uniqueMediaSources([
      ...resolvedSentPhotos.sources,
      ...resolvedInputImages.sources,
      ...(canUseSentPhotoFallback && canUseInputImageFallback ? media.inputImageFallbackSources : []),
      ...media.resultImageFallbackSources
    ]);
  const videoSources = uniqueMediaSources([
      ...resolvedVideos.sources,
      ...media.telegramVideoSources,
      ...(canUseVideoFallback ? media.resultVideoFallbackSources : [])
    ]);

  return {
    inputImageSources,
    imageSources,
    posterSources: media.resultImageFallbackSources,
    previewImageSources: uniqueMediaSources([
      ...imageSources,
      ...media.resultImageFallbackSources
    ]),
    videoSources,
    imageLoading: resolvedInputImages.loading || resolvedSentPhotos.loading,
    videoLoading: resolvedVideos.loading,
    hasTelegramVideoFileId: media.videoFileIds.length > 0,
    hasTelegramImageFileId: media.sentPhotoFileIds.length > 0 || media.inputImageFileIds.length > 0,
    resolvedVideoSource: resolvedSourceLabel(videoSources[0], {
      loading: resolvedVideos.loading,
      hasTelegramFileId: media.videoFileIds.length > 0
    }),
    resolvedImageSource: resolvedSourceLabel(imageSources[0], {
      loading: resolvedInputImages.loading || resolvedSentPhotos.loading,
      hasTelegramFileId: media.sentPhotoFileIds.length > 0 || media.inputImageFileIds.length > 0
    })
  };
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

function MediaSourceBadge({ source }) {
  return (
    <span className="inline-flex rounded-full border border-primary/24 bg-primary/10 px-2 py-1 text-xs text-primary">
      {mediaSourceLabel(source)}
    </span>
  );
}

function MediaFallback({ reason = "preview_unavailable", loading = false }) {
  return (
    <div className="grid aspect-video place-items-center rounded-lg border border-line bg-ink/32 px-4 text-center">
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-md border border-red-300/18 bg-red-400/10 text-red-200">
          {loading ? <PlayCircle className="h-5 w-5 animate-pulse" /> : <ImageOff className="h-5 w-5" />}
        </div>
        <p className="mt-3 text-sm font-medium text-text">{loading ? "Resolving preview" : "Preview unavailable"}</p>
        {!loading ? (
          <span className="mt-2 inline-flex rounded-full border border-line px-2 py-1 text-xs text-text/58">
            {MEDIA_SOURCE_LABELS.unavailable}
          </span>
        ) : null}
        <span className="mt-2 inline-flex rounded-full border border-red-300/18 bg-red-400/10 px-2 py-1 text-xs text-red-100">
          {reason}
        </span>
      </div>
    </div>
  );
}

function ProgressiveImage({ sources, alt, loading = false, reason, className = "aspect-video w-full rounded-lg border border-line object-cover" }) {
  const sourceKey = sources.map((source) => source.url).join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [sourceKey]);

  const src = sources[index]?.url;

  if (!src) {
    return <MediaFallback loading={loading} reason={reason} />;
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}

function MediaImage({ label, sources, alt, loading, reason, showFallback = false }) {
  if (!sources.length && !loading && !showFallback) {
    return null;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-text/38">{label}</p>
        <MediaSourceBadge source={sources[0]} />
      </div>
      <ProgressiveImage sources={sources} alt={alt} loading={loading} reason={reason} />
    </div>
  );
}

function VideoPreview({ sources, posterSources = [], loading, activityId, title, time }) {
  const sourceKey = sources.map((source) => source.url).join("|");
  const posterKey = posterSources.map((source) => source.url).join("|");
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [posterIndex, setPosterIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const source = sources[sourceIndex];
  const src = source?.url;
  const poster = posterSources[posterIndex]?.url || "";

  useEffect(() => {
    setSourceIndex(0);
    setVideoFailed(false);
    setReady(false);
  }, [sourceKey]);

  useEffect(() => {
    setPosterIndex(0);
  }, [posterKey]);

  useEffect(() => {
    if (!src || !videoRef.current) {
      return undefined;
    }

    setReady(false);
    const node = videoRef.current;
    const player = new Plyr(node, {
      theme: "dark",
      controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
      settings: ["quality", "speed"],
      quality: {
        default: 720,
        options: [1080, 720, 480, 360]
      }
    });

    playerRef.current = player;

    const handleReady = () => setReady(true);
    const handleError = () => {
      if (sourceIndex < sources.length - 1) {
        setSourceIndex((current) => current + 1);
      } else {
        setVideoFailed(true);
      }
    };

    player.on("ready", handleReady);
    player.on("error", handleError);
    node.addEventListener("error", handleError, true);

    return () => {
      node.removeEventListener("error", handleError, true);
      player.destroy();
      playerRef.current = null;
    };
  }, [src, sourceIndex, sources.length]);

  if (!src && !loading) {
    return null;
  }

  async function handleDownload() {
    if (!src) {
      return;
    }

    setDownloading(true);
    setDownloadStatus("");

    try {
      const result = await downloadFile(src, videoDownloadFilename({ title, time, id: activityId }));
      setDownloadStatus(result.message || "");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-text/38">Video preview</p>
        <MediaSourceBadge source={source} />
      </div>
      <div className="relative overflow-hidden rounded-lg border border-line bg-black">
        <div className="aspect-video">
          {src && !videoFailed ? (
            <video
              ref={videoRef}
              className="h-full w-full"
              playsInline
              controls
              preload="metadata"
              poster={poster}
              key={src}
            >
              <source src={src} type="video/mp4" size="720" />
            </video>
          ) : (
            <div className="grid h-full place-items-center px-4 text-center text-sm text-text/58">
              <span>
                Video preview could not load here.
                {src ? (
                  <>
                    {" "}
                    <a className="text-primary hover:text-text" href={src} target="_blank" rel="noreferrer">
                      Open video
                    </a>
                  </>
                ) : null}
              </span>
            </div>
          )}
        </div>
        {(loading || !ready) && !videoFailed ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/38 text-sm text-text/72">
            Loading player...
          </div>
        ) : null}
      </div>
      {src ? (
        <div className="flex flex-wrap gap-2">
          <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={handleDownload} disabled={downloading}>
            <Download className="h-4 w-4" />
            {downloading ? "Preparing..." : "Download video"}
          </button>
          <a className={`${buttonClass} inline-flex items-center gap-2`} href={src} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open video
          </a>
          {downloadStatus ? <span className="self-center text-sm text-text/58">{downloadStatus}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function ActivityDetails({ activity, onClose }) {
  const media = useActivityMedia(activity || {});

  useEffect(() => {
    if (!activity) {
      return;
    }

    addDeveloperConsoleEntry({
      source: "activity media resolver",
      method: "MEDIA",
      url: `activity://${activity.id}`,
      status: "resolved",
      ok: true,
      resolvedVideoSource: media.resolvedVideoSource,
      resolvedImageSource: media.resolvedImageSource,
      requestPayload: {
        activityId: activity.id,
        hasTelegramVideoFileId: media.hasTelegramVideoFileId,
        hasTelegramImageFileId: media.hasTelegramImageFileId
      },
      responseJson: {
        resolvedVideoSource: media.resolvedVideoSource,
        resolvedImageSource: media.resolvedImageSource,
        videoSourceKind: media.videoSources[0]?.kind || null,
        imageSourceKind: media.imageSources[0]?.kind || null
      }
    });
  }, [
    activity?.id,
    media.resolvedVideoSource,
    media.resolvedImageSource,
    media.hasTelegramVideoFileId,
    media.hasTelegramImageFileId,
    media.videoSources[0]?.kind,
    media.imageSources[0]?.kind
  ]);

  if (!activity) {
    return null;
  }

  const user = displayUser(activity);
  const botResponse = activity.botResponse || {};
  const similarity = botResponse.similarity ?? activity.similarity;
  const reason = failureLabel(activity);
  const hasVideo = media.videoSources.length > 0 || media.videoLoading;
  const hasImage = media.imageSources.length > 0 || media.imageLoading;
  const hasInputImage = media.inputImageSources.length > 0 || media.imageLoading;

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
          <MediaImage label="User input preview" sources={media.inputImageSources} alt="User input preview" loading={media.imageLoading} reason={reason} showFallback />
          {hasVideo ? (
            <VideoPreview
              sources={media.videoSources}
              posterSources={media.posterSources}
              loading={media.videoLoading}
              activityId={activity.id}
              title={activity.animeTitle || botResponse.title}
              time={activity.formattedTime || botResponse.time}
            />
          ) : hasImage ? (
            <MediaImage label="Image preview" sources={media.imageSources} alt="Media preview" loading={media.imageLoading} reason={reason} showFallback />
          ) : !hasInputImage ? (
            <MediaFallback reason={reason} />
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Status" value={normalizeActivityStatus(activity.status)} />
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
              <DetailRow label="Input file ID" value={activity.inputFileId || activity.media?.inputTelegramFileId} />
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
              <DetailRow label="Sent video file ID" value={activity.media?.sentVideoFileId} />
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

function ActivityCard({ activity, selectMode, selected, onSelect, onOpen, onDelete }) {
  const media = useActivityMedia(activity);
  const user = displayUser(activity);
  const reason = failureLabel(activity);

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-panel text-left transition hover:border-primary">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative">
          <ProgressiveImage
            sources={media.previewImageSources}
            alt="Activity preview"
            loading={media.imageLoading}
            reason={reason}
            className="aspect-video w-full object-cover"
          />
          {media.videoSources.length || media.videoLoading ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-ink/80 px-2 py-1 text-xs font-medium text-primary backdrop-blur">
              <PlayCircle className="h-3.5 w-3.5 fill-current" />
              Video
            </span>
          ) : null}
        </div>
      </button>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <StatusPill status={normalizeActivityStatus(activity.status)} />
          <span className="text-xs text-text/46">{formatDate(activity.createdAt)}</span>
        </div>
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <p className="line-clamp-1 font-medium text-text">{activity.animeTitle || activity.botResponse?.title || "No match"}</p>
          <p className="mt-1 text-xs text-text/50">{user.displayName} / {activity.inputType || activity.source || "unknown"}</p>
          <p className="mt-3 text-sm text-text/62">
            {activity.formattedTime || activity.botResponse?.time || activity.rejectionReason || activity.error || "Open details"}
          </p>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {selectMode ? (
            <label className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-text/72">
              <input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} />
              Select
            </label>
          ) : null}
          <button className={buttonClass} type="button" onClick={onDelete}>
            <Trash2 className="mr-2 inline h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export function Activities() {
  const activities = useFirestoreCollection(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(300)), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [viewMode, setViewMode] = usePersistentState("novapanel-activities-view", "grid");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activities.data.filter((activity) => {
      if (isTechnicalFailure(activity)) {
        return false;
      }

      const normalizedStatus = normalizeActivityStatus(activity.status);
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

  function toggleSelected(activityId, checked) {
    setSelectedActivityIds((current) =>
      checked ? [...new Set([...current, activityId])] : current.filter((id) => id !== activityId)
    );
  }

  function requestDelete(ids) {
    setDeleteError("");
    setDeleteRequest({
      ids,
      title: ids.length === 1 ? "Delete Activity?" : "Delete Selected Activities?",
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
      await Promise.all(deleteRequest.ids.map((id) => deleteFirestoreDocument(db, "activities", id, { source: "activities page delete" })));
      setSelectedActivityIds([]);
      setSelectMode(false);
      setSelectedActivity((current) => current && deleteRequest.ids.includes(current.id) ? null : current);
      setDeleteRequest(null);
    } catch (error) {
      setDeleteError(error.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  function cancelSelection() {
    setSelectMode(false);
    setSelectedActivityIds([]);
  }

  if (activities.error) {
    return <EmptyState title="Could not load activities" detail={activities.error} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Activities</h1>
          <p className="text-sm text-text/54">Successful analyses, valid matches, and low-similarity rejections.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {selectMode ? (
            <>
              <span className="rounded-md border border-line px-3 py-2 text-sm text-text/62">{selectedActivityIds.length} selected</span>
              {selectedActivityIds.length > 0 ? (
                <button className={buttonClass} type="button" onClick={() => requestDelete(selectedActivityIds)}>
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
          <input className={inputClass} placeholder="Search activity" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="rejected">Rejected</option>
          </select>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No activities found" detail={activities.data.some(isTechnicalFailure) ? "Technical failures are routed to Errors." : null} />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              selectMode={selectMode}
              selected={selectedActivityIds.includes(activity.id)}
              onSelect={(checked) => toggleSelected(activity.id, checked)}
              onOpen={() => setSelectedActivity(activity)}
              onDelete={() => requestDelete([activity.id])}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel backdrop-blur">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-text/42">
              <tr>
                {selectMode ? <th className="px-4 py-3">Select</th> : null}
                <th className="px-4 py-3">Anime</th>
                <th>Status</th>
                <th>Reason</th>
                <th>User</th>
                <th>Input</th>
                <th>Similarity</th>
                <th>Links</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((activity) => {
                const user = displayUser(activity);
                const media = collectMedia(activity);
                const hasVideo = media.videoFileIds.length || media.telegramVideoSources.length || media.resultVideoFallbackSources.length;

                return (
                  <tr key={activity.id} className="cursor-pointer text-text/72 transition hover:bg-ink/20" onClick={() => setSelectedActivity(activity)}>
                    {selectMode ? (
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedActivityIds.includes(activity.id)}
                          onChange={(event) => toggleSelected(activity.id, event.target.checked)}
                          aria-label={`Select activity ${activity.id}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{activity.animeTitle || activity.botResponse?.title || "No match"}</p>
                      <p className="text-xs text-text/46">{activity.formattedTime || activity.botResponse?.time || "-"}</p>
                    </td>
                    <td><StatusPill status={normalizeActivityStatus(activity.status)} /></td>
                    <td>{activity.rejectionReason || activity.error || "-"}</td>
                    <td>{user.displayName}</td>
                    <td>{activity.inputType || activity.source || "-"}</td>
                    <td>{activity.similarity ?? "-"}%</td>
                    <td>
                      <div className="flex gap-3">
                        {activity.anilistUrl ? <a className="text-primary hover:text-text" href={activity.anilistUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>AniList</a> : null}
                        {hasVideo ? (
                          <button className="inline-flex items-center gap-1 text-primary hover:text-text" type="button" onClick={(event) => {
                            event.stopPropagation();
                            setSelectedActivity(activity);
                          }}>
                            <PlayCircle className="h-3.5 w-3.5 fill-current" />
                            Video
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{formatDate(activity.createdAt)}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button className={buttonClass} type="button" onClick={() => requestDelete([activity.id])}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ActivityDetails activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
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
