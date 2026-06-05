import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import JsonView from "@uiw/react-json-view";
import { vscodeTheme } from "@uiw/react-json-view/vscode";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { Copy, Download, ExternalLink, ImageOff, PlayCircle, Trash2, X } from "lucide-react";
import { db } from "../firebase.js";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Drawer } from "../components/Drawer.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { ImageLightbox } from "../components/ImageLightbox.jsx";
import { SelectionToolbar } from "../components/SelectionToolbar.jsx";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection.js";
import { failureLabel, isTechnicalFailure, normalizeActivityStatus } from "../utils/activityTypes.js";
import { getActivityPreviewImageCandidates, isDirectActivityImageUrl } from "../utils/activityPreviewImage.js";
import { downloadFile } from "../utils/downloadFile.js";
import { deleteFirestoreDocument } from "../utils/firestoreDelete.js";
import { addDeveloperConsoleEntry } from "../utils/developerConsole.js";
import { canResolveTelegramFiles, resolveTelegramFileUrl, telegramFileResolverUrl, uniqueStrings } from "../utils/mediaResolver.js";

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "-";
}

function displayUser(activity) {
  const record = activity && typeof activity === "object" ? activity : {};
  const user = record.user && typeof record.user === "object" ? record.user : {};
  return {
    username: user.username || null,
    displayName: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || record.userId,
    telegramId: user.telegramId || record.userId
  };
}

const MEDIA_SOURCE_LABELS = {
  telegram: "Telegram media",
  trace: "trace.moe fallback",
  input: "input image",
  unavailable: "unavailable"
};

const MEDIA_RESOLUTION_TIMEOUT_MS = 12000;
const MEDIA_RESOLUTION_RETRY_DELAYS_MS = [0, 900, 1800];
const MEDIA_STATES = {
  idle: "idle",
  resolving: "resolving",
  telegramAvailable: "telegram_available",
  traceFallback: "trace_fallback",
  available: "available",
  unavailable: "unavailable",
  failed: "failed"
};
const telegramMediaCache = new Map();

function isTraceMoeUrl(url) {
  return /^https:\/\/api\.trace\.moe\//i.test(url);
}

function isUsableMediaUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return ["http:", "https:", "blob:", "data:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isLikelyImageUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(parsed.pathname);
  } catch {
    return /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(url);
  }
}

function validatePlayableVideoUrl(url) {
  const normalized = typeof url === "string" ? url.trim() : "";

  if (!normalized) {
    return {
      ok: false,
      url: "",
      reason: "Resolved video URL is empty."
    };
  }

  let parsed;

  try {
    parsed = new URL(normalized);
  } catch {
    return {
      ok: false,
      url: normalized,
      reason: "Resolved video URL is not a valid URL."
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      url: normalized,
      reason: "Resolved video URL must start with https://."
    };
  }

  if (isLikelyImageUrl(normalized)) {
    return {
      ok: false,
      url: normalized,
      reason: "Resolved video URL points to an image URL."
    };
  }

  return {
    ok: true,
    url: normalized,
    reason: ""
  };
}

function isPlayableVideoUrl(url) {
  return validatePlayableVideoUrl(url).ok;
}

function mediaSource(url, kind, fieldName = null) {
  const [normalized] = uniqueStrings([url]);

  if (!isUsableMediaUrl(normalized)) {
    return null;
  }

  return {
    url: normalized,
    kind: kind || (isTraceMoeUrl(normalized) ? "trace" : "input"),
    fieldName: fieldName || null
  };
}

function uniqueMediaSources(sources) {
  const seen = new Set();

  return (Array.isArray(sources) ? sources : []).filter(Boolean).filter((source) => {
    if (!source || !isUsableMediaUrl(source.url)) {
      return false;
    }

    if (seen.has(source.url)) {
      return false;
    }

    seen.add(source.url);
    return true;
  });
}

function mediaSourceList(entries) {
  return uniqueMediaSources((Array.isArray(entries) ? entries : []).map(([url, kind, fieldName]) => mediaSource(url, kind, fieldName)));
}

function telegramFileCandidate(fileId, fieldName) {
  const [normalized] = uniqueStrings([fileId]);

  if (!normalized) {
    return null;
  }

  return {
    fileId: normalized,
    fieldName: fieldName || null
  };
}

function uniqueTelegramFileCandidates(candidates) {
  const seen = new Set();

  return (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => {
      if (typeof candidate === "string") {
        return telegramFileCandidate(candidate, null);
      }

      return telegramFileCandidate(candidate?.fileId, candidate?.fieldName);
    })
    .filter(Boolean)
    .filter((candidate) => {
      if (seen.has(candidate.fileId)) {
        return false;
      }

      seen.add(candidate.fileId);
      return true;
    });
}

function splitPlayableVideoSources(sources) {
  return uniqueMediaSources(sources).reduce((result, source) => {
    const validation = validatePlayableVideoUrl(source?.url);

    if (validation.ok) {
      result.validSources.push({
        ...source,
        url: validation.url
      });
      return result;
    }

    result.invalidSources.push({
      source,
      reason: validation.reason
    });
    return result;
  }, {
    validSources: [],
    invalidSources: []
  });
}

function mediaCacheKeys(fileId, kind, activityId, url) {
  const safeFileId = String(fileId || "").trim();
  const safeActivityId = String(activityId || "unknown").trim();
  const keys = [];

  if (safeFileId) {
    keys.push(`telegram:${kind}:${safeFileId}`);
    keys.push(`activity:${safeActivityId}:${kind}:${safeFileId}`);
  }

  if (isUsableMediaUrl(url)) {
    keys.push(`url:${kind}:${url}`);
    keys.push(`activity-url:${safeActivityId}:${kind}:${url}`);
  }

  return keys;
}

function getCachedTelegramSource(fileId, kind, activityId, fieldName = null) {
  const cachedUrl = mediaCacheKeys(fileId, kind, activityId).map((key) => telegramMediaCache.get(key)).find(Boolean);
  return mediaSource(cachedUrl, kind, fieldName);
}

function cacheTelegramSource(fileId, kind, activityId, url) {
  if (!isUsableMediaUrl(url)) {
    return;
  }

  mediaCacheKeys(fileId, kind, activityId, url).forEach((key) => {
    telegramMediaCache.set(key, url);
  });
}

function withMediaTimeout(promise, timeoutMs = MEDIA_RESOLUTION_TIMEOUT_MS) {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`Media resolution timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function waitForMediaRetry(delayMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function sourceAvailabilityState(source) {
  if (source?.kind === "telegram") {
    return MEDIA_STATES.telegramAvailable;
  }

  if (source?.kind === "trace") {
    return MEDIA_STATES.traceFallback;
  }

  if (source) {
    return MEDIA_STATES.available;
  }

  return MEDIA_STATES.unavailable;
}

function telegramResolutionSettled(state) {
  return Boolean(
    state?.settled ||
    state?.status === MEDIA_STATES.failed ||
    state?.status === MEDIA_STATES.unavailable
  );
}

function canUseFallbackAfterTelegram({ hasTelegramFileId, resolvedSources, resolverState }) {
  return !resolvedSources.length && (!hasTelegramFileId || telegramResolutionSettled(resolverState));
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

function invalidVideoReason(entry) {
  const fieldName = entry?.source?.fieldName || entry?.source?.kind || "video source";
  return `${fieldName}: ${entry?.reason || "Video source is not playable."}`;
}

function mediaAttemptPreview(value) {
  const text = String(value || "");

  if (text.length <= 96) {
    return text;
  }

  return `${text.slice(0, 44)}...${text.slice(-24)}`;
}

function mediaFailureReason(error) {
  const message = error?.message || String(error || "");

  if (/timed out/i.test(message)) {
    return "resolver_timeout";
  }

  if (/failed to fetch|cors/i.test(message)) {
    return "cors_error";
  }

  if (/no usable URL|not a valid URL|must start with https|image URL|invalid_response_shape/i.test(message)) {
    return "invalid_response_shape";
  }

  if (/Telegram file resolution failed|Telegram file path/i.test(message)) {
    return "telegram_get_file_failed";
  }

  return message || "media_resolution_failed";
}

function mediaFieldsAvailable(activity = {}) {
  const media = activity.media && typeof activity.media === "object" ? activity.media : {};

  return {
    media: Boolean(activity.media && typeof activity.media === "object"),
    sentVideoFileId: Boolean(media.sentVideoFileId || activity.sentVideoFileId),
    sentAnimationFileId: Boolean(media.sentAnimationFileId || activity.sentAnimationFileId),
    topLevelSentVideoFileId: Boolean(activity.sentVideoFileId),
    topLevelSentAnimationFileId: Boolean(activity.sentAnimationFileId),
    mediaSentVideoFileId: Boolean(media.sentVideoFileId),
    mediaSentAnimationFileId: Boolean(media.sentAnimationFileId),
    sentPhotoFileId: Boolean(media.sentPhotoFileId || activity.sentPhotoFileId),
    inputTelegramFileId: Boolean(media.inputTelegramFileId || activity.inputTelegramFileId || activity.inputFileId),
    inputTelegramFileUrl: Boolean(media.inputTelegramFileUrl || activity.inputTelegramFileUrl),
    resultVideoUrl: Boolean(activity.resultVideoUrl),
    mediaResultVideoUrl: Boolean(media.resultVideoUrl),
    legacyVideoUrl: Boolean(activity.videoUrl),
    botResponseVideoUrl: Boolean(activity.botResponse?.videoUrl),
    resultImageUrl: Boolean(media.resultImageUrl || activity.resultImageUrl || activity.imageUrl || activity.botResponse?.imageUrl),
    extractedImageUrl: Boolean(media.extractedImageUrl || activity.extractedImageUrl),
    inputSourceDomain: Boolean(activity.inputSourceDomain),
    previewExtractionStatus: Boolean(activity.previewExtractionStatus),
    videoUrl: Boolean(activity.videoUrl),
    imageUrl: Boolean(activity.imageUrl),
    inputUrl: Boolean(activity.inputUrl)
  };
}

function safeAddDeveloperConsoleEntry(entry) {
  try {
    addDeveloperConsoleEntry(entry);
  } catch (error) {
    console.warn("Developer Console logging failed.", error);
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: "Activity JSON could not be serialized.",
      message: error.message
    }, null, 2);
  }
}

function RawJsonViewer({ value }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(1);
  const jsonText = useMemo(() => safeStringify(value), [value]);
  const parsedValue = useMemo(() => {
    try {
      return JSON.parse(jsonText);
    } catch {
      return {
        error: "JSON could not be parsed for the tree viewer.",
        raw: jsonText
      };
    }
  }, [jsonText]);
  const lineCount = jsonText.split("\n").length;

  async function copyJson() {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <details className="rounded-lg border border-line bg-ink/24" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="json-panel-summary flex cursor-pointer list-none flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium text-text">Raw JSON</h3>
          <p className="text-xs text-text/42">Expandable syntax-highlighted payload</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-xs text-text/70 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              copyJson();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            className="inline-flex h-9 items-center rounded-md border border-line px-3 text-xs text-text/70 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
              setCollapsed(false);
            }}
          >
            Expand all
          </button>
          <button
            className="inline-flex h-9 items-center rounded-md border border-line px-3 text-xs text-text/70 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
              setCollapsed(true);
            }}
          >
            Collapse all
          </button>
        </div>
      </summary>
      <div className="border-t border-line px-4 pb-4">
        <div className="mt-3 flex max-h-[30rem] overflow-hidden rounded-md border border-line bg-ink/28">
          <div className="select-none border-r border-line bg-ink/32 px-2 py-3 text-right font-mono text-xs leading-6 text-text/28">
            {Array.from({ length: lineCount }, (_, index) => (
              <div key={index + 1}>{index + 1}</div>
            ))}
          </div>
          <div className="json-scroll min-w-0 flex-1 overflow-auto p-3 font-mono text-xs leading-6">
            <JsonView
              key={String(collapsed)}
              value={parsedValue}
              style={{
                ...vscodeTheme,
                backgroundColor: "transparent",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "12px"
              }}
              collapsed={collapsed}
              displayDataTypes={false}
              enableClipboard
              shortenTextAfterLength={100}
            />
          </div>
        </div>
      </div>
    </details>
  );
}

function ActivityPreviewFallback({ activity, error, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <section className="ml-auto flex h-full max-w-xl flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Activity details</p>
            <h2 className="mt-1 text-xl font-semibold text-text">Unable to render this activity preview.</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-md border border-line text-text/62 transition hover:text-primary" type="button" onClick={onClose} aria-label="Close details">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          <p className="rounded-md border border-red-300/18 bg-red-400/10 px-3 py-2 text-sm text-red-100">
            {error?.message || "The activity contains media data that could not be rendered safely."}
          </p>
          <details className="rounded-md border border-line bg-ink/28">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text/72">Developer data</summary>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all px-3 pb-3 text-xs text-text/62">{safeStringify(activity)}</pre>
          </details>
        </div>
      </section>
    </div>
  );
}

class ActivityPreviewBoundary extends Component {
  state = {
    error: null
  };

  static getDerivedStateFromError(error) {
    return {
      error
    };
  }

  componentDidCatch(error) {
    safeAddDeveloperConsoleEntry({
      source: "activity preview",
      method: "RENDER",
      url: `activity://${this.props.activity?.id || "unknown"}`,
      status: "preview-render-failed",
      ok: false,
      requestPayload: {
        activityId: this.props.activity?.id || null,
        mediaFieldsAvailable: mediaFieldsAvailable(this.props.activity || {}),
        attemptedSource: "activity preview render"
      },
      errorJson: {
        message: error.message
      }
    });
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({
        error: null
      });
    }
  }

  render() {
    if (this.state.error) {
      return <ActivityPreviewFallback activity={this.props.activity} error={this.state.error} onClose={this.props.onClose} />;
    }

    return this.props.children;
  }
}

function ActivityMediaPreviewFallback({ activity, error }) {
  return (
    <div className="rounded-lg border border-red-300/18 bg-red-400/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-red-100">Preview media could not render.</p>
          <p className="mt-1 text-xs text-red-100/68">{error?.message || "The media player failed safely."}</p>
        </div>
        <span className="rounded-md border border-red-300/18 px-2 py-1 font-mono text-xs text-red-100/72">
          {activity?.id || "unknown"}
        </span>
      </div>
    </div>
  );
}

class ActivityMediaPreviewBoundary extends Component {
  state = {
    error: null
  };

  static getDerivedStateFromError(error) {
    return {
      error
    };
  }

  componentDidCatch(error) {
    safeAddDeveloperConsoleEntry({
      source: "activity media preview",
      method: "RENDER",
      url: `activity://${this.props.activity?.id || "unknown"}`,
      status: "media-preview-render-failed",
      ok: false,
      requestPayload: {
        activityId: this.props.activity?.id || null,
        mediaFieldsAvailable: mediaFieldsAvailable(this.props.activity || {}),
        attemptedSource: "activity preview media"
      },
      errorJson: {
        message: error.message,
        exactError: error.message
      }
    });
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({
        error: null
      });
    }
  }

  render() {
    if (this.state.error) {
      return <ActivityMediaPreviewFallback activity={this.props.activity} error={this.state.error} />;
    }

    return this.props.children;
  }
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
  const record = activity && typeof activity === "object" ? activity : {};
  const media = record.media && typeof record.media === "object" ? record.media : {};
  const botResponse = record.botResponse && typeof record.botResponse === "object" ? record.botResponse : {};
  const previewImageSources = mediaSourceList(
    getActivityPreviewImageCandidates(record).map((url) => [
      url,
      isTraceMoeUrl(url) ? "trace" : "input",
      "activityPreviewImage"
    ])
  );
  const inputImageFileCandidates = uniqueTelegramFileCandidates([
    telegramFileCandidate(media.inputTelegramFileId, "media.inputTelegramFileId"),
    telegramFileCandidate(record.inputTelegramFileId, "inputTelegramFileId"),
    telegramFileCandidate(record.inputFileId, "inputFileId")
  ]);
  const sentPhotoFileCandidates = uniqueTelegramFileCandidates([
    telegramFileCandidate(media.sentPhotoFileId, "media.sentPhotoFileId"),
    telegramFileCandidate(record.sentPhotoFileId, "sentPhotoFileId")
  ]);
  const videoFileCandidates = uniqueTelegramFileCandidates([
    telegramFileCandidate(media.sentVideoFileId, "media.sentVideoFileId"),
    telegramFileCandidate(record.sentVideoFileId, "sentVideoFileId"),
    telegramFileCandidate(media.sentAnimationFileId, "media.sentAnimationFileId"),
    telegramFileCandidate(record.sentAnimationFileId, "sentAnimationFileId")
  ]);
  const telegramVideoSources = mediaSourceList([
    [media.botVideoUrl, "telegram", "media.botVideoUrl"],
    [record.botVideoUrl, "telegram", "botVideoUrl"]
  ]);
  const resultVideoFallbackSources = mediaSourceList([
    [media.resultVideoUrl, "trace", "media.resultVideoUrl"],
    [record.resultVideoUrl, "trace", "resultVideoUrl"],
    [botResponse.videoUrl, "trace", "botResponse.videoUrl"],
    [record.videoUrl, "trace", "videoUrl"]
  ]);
  const selectedVideoCandidate = videoFileCandidates[0] || null;
  const selectedVideoFallback = telegramVideoSources[0] || resultVideoFallbackSources[0] || null;

  return {
    inputImageFileCandidates,
    inputImageFileIds: inputImageFileCandidates.map((candidate) => candidate.fileId),
    sentPhotoFileCandidates,
    sentPhotoFileIds: sentPhotoFileCandidates.map((candidate) => candidate.fileId),
    videoFileCandidates,
    videoFileIds: videoFileCandidates.map((candidate) => candidate.fileId),
    telegramVideoSources,
    telegramImageSources: mediaSourceList([
      [media.botImageUrl, "telegram", "media.botImageUrl"],
      [record.botImageUrl, "telegram", "botImageUrl"]
    ]),
    inputImageFallbackSources: mediaSourceList([
      [media.inputTelegramFileUrl, "input", "media.inputTelegramFileUrl"],
      [record.inputTelegramFileUrl, "input", "inputTelegramFileUrl"],
      [media.extractedImageUrl, "input", "media.extractedImageUrl"],
      [record.extractedImageUrl, "input", "extractedImageUrl"],
      [media.inputImageUrl, "input", "media.inputImageUrl"],
      [record.inputImageUrl, "input", "inputImageUrl"],
      [record.inputPreview, "input", "inputPreview"],
      [record.inputThumbnail, "input", "inputThumbnail"],
      [isDirectActivityImageUrl(record.inputUrl) ? record.inputUrl : null, "input", "inputUrl"]
    ]),
    resultImageFallbackSources: previewImageSources,
    resultVideoFallbackSources,
    selectionDebug: {
      activityId: record.id || null,
      selectedVideoField: selectedVideoCandidate?.fieldName || selectedVideoFallback?.fieldName || null,
      selectedVideoFileId: selectedVideoCandidate?.fileId || null,
      selectedFallbackUrl: selectedVideoFallback?.url || null,
      selectedFallbackField: selectedVideoFallback?.fieldName || null,
      hasTopLevelSentVideoFileId: Boolean(record.sentVideoFileId),
      hasMediaSentVideoFileId: Boolean(media.sentVideoFileId),
      hasTopLevelSentAnimationFileId: Boolean(record.sentAnimationFileId),
      hasMediaSentAnimationFileId: Boolean(media.sentAnimationFileId)
    }
  };
}

function useResolvedTelegramSources(fileIds, kind = "telegram", context = {}) {
  const safeFileCandidates = uniqueTelegramFileCandidates(Array.isArray(fileIds) ? fileIds : []);
  const safeFileIds = safeFileCandidates.map((candidate) => candidate.fileId);
  const isVideoAttempt = context.mediaRole === "video";
  const contextKey = `${context.activityId || "unknown"}:${context.attemptedSource || kind}`;
  const key = `${contextKey}:${kind}:${safeFileCandidates.map((candidate) => `${candidate.fieldName || "field"}=${candidate.fileId}`).join("|")}`;
  const resolverUrlBase = context.resolverUrl || "dashboard://telegram-file";
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState({
    sources: [],
    loading: false,
    settled: false,
    status: MEDIA_STATES.idle,
    error: ""
  });

  useEffect(() => {
    let active = true;
    const cachedSources = uniqueMediaSources(
      safeFileCandidates.map((candidate) => getCachedTelegramSource(candidate.fileId, kind, context.activityId, candidate.fieldName))
    );
    const unresolvedFileCandidates = safeFileCandidates.filter((candidate) =>
      !getCachedTelegramSource(candidate.fileId, kind, context.activityId, candidate.fieldName)
    );

    if (!safeFileIds.length) {
      setState({
        sources: cachedSources,
        loading: false,
        settled: false,
        status: cachedSources.length ? MEDIA_STATES.telegramAvailable : MEDIA_STATES.idle,
        error: ""
      });
      return () => {
        active = false;
      };
    }

    if (!canResolveTelegramFiles()) {
      const errorMessage = "Telegram media resolver endpoint is not configured.";

      if (context.logFailures) {
        safeFileCandidates.forEach((candidate) => {
          const diagnosticFields = {
            selectedField: candidate.fieldName || null,
            selectedValuePreview: mediaAttemptPreview(candidate.fileId),
            endpoint: resolverUrlBase,
            requestStartedAt: new Date().toISOString(),
            requestEndedAt: new Date().toISOString(),
            responseStatus: null,
            responseJson: null,
            resolvedUrlPreview: null,
            resolverStatus: MEDIA_STATES.failed,
            playerStatus: null,
            fallbackUsed: Boolean(context.hasTraceFallback),
            fallbackReason: context.hasTraceFallback ? "telegram_resolver_not_configured" : errorMessage,
            chosenVideoFieldName: isVideoAttempt ? candidate.fieldName || null : null,
            chosenFileIdOrUrl: isVideoAttempt ? candidate.fileId : null,
            endpointCalled: resolverUrlBase,
            finalResolvedVideoUrl: null,
            failureReason: errorMessage
          };

          safeAddDeveloperConsoleEntry({
            source: "activity media resolver",
            method: "MEDIA",
            url: `telegram-file://${candidate.fileId}`,
            status: MEDIA_STATES.failed,
            ok: false,
            requestPayload: {
              activityId: context.activityId || null,
              mediaType: kind,
              selectedSource: "telegram",
              fileId: candidate.fileId,
              fieldName: candidate.fieldName || null,
              fileIdPresent: Boolean(candidate.fileId),
              resolverUrl: resolverUrlBase,
              mediaFieldsAvailable: context.mediaFieldsAvailable || {},
              attemptedSource: context.attemptedSource || kind,
              fallbackDecision: context.hasTraceFallback ? MEDIA_STATES.traceFallback : MEDIA_STATES.failed,
              ...diagnosticFields
            },
            errorJson: {
              activityId: context.activityId || null,
              mediaType: kind,
              selectedSource: "telegram",
              resolverState: MEDIA_STATES.failed,
              exactError: errorMessage,
              fallbackDecision: context.hasTraceFallback ? MEDIA_STATES.traceFallback : MEDIA_STATES.failed,
              ...diagnosticFields
            }
          });
        });
      }

      setState({
        sources: cachedSources,
        loading: false,
        settled: true,
        status: cachedSources.length ? MEDIA_STATES.telegramAvailable : MEDIA_STATES.failed,
        error: errorMessage
      });
      return () => {
        active = false;
      };
    }

    if (!unresolvedFileCandidates.length) {
      setState({
        sources: cachedSources,
        loading: false,
        settled: true,
        status: cachedSources.length ? MEDIA_STATES.telegramAvailable : MEDIA_STATES.unavailable,
        error: ""
      });
      return () => {
        active = false;
      };
    }

    setState({
      sources: cachedSources,
      loading: true,
      settled: false,
      status: cachedSources.length ? MEDIA_STATES.telegramAvailable : MEDIA_STATES.resolving,
      error: ""
    });

    Promise.allSettled(unresolvedFileCandidates.map(async (candidate) => {
      const fileId = candidate.fileId;
      const fieldName = candidate.fieldName || null;
      const requestTime = new Date().toISOString();
      const startedAt = performance.now();
      const requestUrl = `telegram-file://${fileId}`;
      const resolverUrl = telegramFileResolverUrl(fileId) || `${resolverUrlBase}/${encodeURIComponent(fileId)}`;
      const diagnosticFields = (extra = {}) => ({
        selectedField: fieldName,
        selectedValuePreview: mediaAttemptPreview(fileId),
        endpoint: resolverUrl,
        requestStartedAt: requestTime,
        chosenVideoFieldName: isVideoAttempt ? fieldName : null,
        chosenFileIdOrUrl: isVideoAttempt ? fileId : null,
        endpointCalled: resolverUrl,
        ...extra
      });
      let attempt = 0;
      let lastError = null;

      try {
        let url = null;

        for (const delayMs of MEDIA_RESOLUTION_RETRY_DELAYS_MS) {
          attempt += 1;

          if (delayMs > 0) {
            await waitForMediaRetry(delayMs);
          }

          try {
            url = await withMediaTimeout(resolveTelegramFileUrl(fileId, {
              activityId: context.activityId || null,
              mediaType: kind,
              mediaRole: context.mediaRole || null,
              selectedSource: "telegram",
              fieldName,
              chosenFieldName: fieldName,
              chosenVideoFieldName: isVideoAttempt ? fieldName : null,
              chosenFileIdOrUrl: isVideoAttempt ? fileId : null,
              endpointCalled: resolverUrl,
              selectedField: fieldName,
              selectedValuePreview: mediaAttemptPreview(fileId),
              endpoint: resolverUrl,
              fileIdPresent: Boolean(fileId),
              resolverUrl,
              attempt,
              maxAttempts: MEDIA_RESOLUTION_RETRY_DELAYS_MS.length,
              fallbackDecision: "pending"
            }));
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!url && lastError) {
          throw lastError;
        }

        const durationMs = Math.round(performance.now() - startedAt);
        const resolvedVideoValidation = isVideoAttempt
          ? validatePlayableVideoUrl(url)
          : {
              ok: isUsableMediaUrl(url),
              url,
              reason: "Media resolver returned no usable URL."
            };

        if (!resolvedVideoValidation.ok) {
          throw new Error(resolvedVideoValidation.reason);
        }

        url = resolvedVideoValidation.url;
        cacheTelegramSource(fileId, kind, context.activityId, url);

        if (context.logFailures) {
          const responseTime = new Date().toISOString();

          safeAddDeveloperConsoleEntry({
            source: "activity media resolver",
            method: "MEDIA",
            url: requestUrl,
            status: "resolved",
            ok: true,
            requestTime,
            responseTime,
            durationMs,
            requestPayload: {
              activityId: context.activityId || null,
              mediaType: kind,
              selectedSource: "telegram",
              fileId,
              fieldName,
              fileIdPresent: Boolean(fileId),
              resolverUrl,
              requestUrl,
              attempts: attempt,
              mediaFieldsAvailable: context.mediaFieldsAvailable || {},
              attemptedSource: context.attemptedSource || kind,
              fallbackDecision: MEDIA_STATES.telegramAvailable,
              ...diagnosticFields({
                requestEndedAt: responseTime,
                responseStatus: "resolved",
                responseJson: null,
                resolvedUrlPreview: mediaAttemptPreview(url),
                resolverStatus: MEDIA_STATES.telegramAvailable,
                playerStatus: null,
                fallbackUsed: false,
                fallbackReason: null,
                finalResolvedVideoUrl: url,
                failureReason: null
              })
            },
            responseJson: {
              activityId: context.activityId || null,
              mediaType: kind,
              fileId,
              fieldName,
              resolvedUrl: url,
              selectedSource: "telegram",
              resolverUrl,
              responseStatus: "resolved",
              resolverState: MEDIA_STATES.telegramAvailable,
              fallbackDecision: MEDIA_STATES.telegramAvailable,
              ...diagnosticFields({
                requestEndedAt: responseTime,
                resolvedUrlPreview: mediaAttemptPreview(url),
                resolverStatus: MEDIA_STATES.telegramAvailable,
                playerStatus: null,
                fallbackUsed: false,
                fallbackReason: null,
                finalResolvedVideoUrl: url,
                failureReason: null
              })
            }
          });
        }

        return mediaSource(url, kind, fieldName);
      } catch (error) {
        const durationMs = Math.round(performance.now() - startedAt);
        const timedOut = /timed out/i.test(error.message || "");
        const failureReason = mediaFailureReason(error);

        if (context.logFailures) {
          const responseTime = new Date().toISOString();

          safeAddDeveloperConsoleEntry({
            source: "activity media resolver",
            method: "MEDIA",
            url: requestUrl,
            status: timedOut ? "timeout" : "failed",
            ok: false,
            requestTime,
            responseTime,
            durationMs,
            requestPayload: {
              activityId: context.activityId || null,
              mediaType: kind,
              selectedSource: "telegram",
              fileId,
              fieldName,
              fileIdPresent: Boolean(fileId),
              resolverUrl,
              requestUrl,
              attempts: attempt,
              mediaFieldsAvailable: context.mediaFieldsAvailable || {},
              attemptedSource: context.attemptedSource || kind,
              fallbackDecision: context.hasTraceFallback ? MEDIA_STATES.traceFallback : MEDIA_STATES.failed,
              ...diagnosticFields({
                requestEndedAt: responseTime,
                responseStatus: timedOut ? "timeout" : "failed",
                responseJson: null,
                resolvedUrlPreview: null,
                resolverStatus: MEDIA_STATES.failed,
                playerStatus: null,
                fallbackUsed: Boolean(context.hasTraceFallback),
                fallbackReason: failureReason,
                finalResolvedVideoUrl: null,
                failureReason
              })
            },
            errorJson: {
              activityId: context.activityId || null,
              mediaType: kind,
              fileId,
              fieldName,
              selectedSource: "telegram",
              resolverUrl,
              responseStatus: timedOut ? "timeout" : "failed",
              resolverState: MEDIA_STATES.failed,
              exactError: error.message || "Media resolution failed.",
              fallbackDecision: context.hasTraceFallback ? MEDIA_STATES.traceFallback : MEDIA_STATES.failed,
              ...diagnosticFields({
                requestEndedAt: responseTime,
                resolvedUrlPreview: null,
                resolverStatus: MEDIA_STATES.failed,
                playerStatus: null,
                fallbackUsed: Boolean(context.hasTraceFallback),
                fallbackReason: failureReason,
                finalResolvedVideoUrl: null,
                failureReason
              })
            }
          });
        }

        throw error;
      }
    })).then((results) => {
      if (!active) {
        return;
      }

      const failures = results.filter((result) => result.status === "rejected");
      const resolvedSources = uniqueMediaSources([
        ...cachedSources,
        ...results.map((result) => result.status === "fulfilled" ? result.value : null)
      ]);

      setState({
        sources: resolvedSources,
        loading: false,
        settled: true,
        status: resolvedSources.length
          ? MEDIA_STATES.telegramAvailable
          : failures.length
            ? MEDIA_STATES.failed
            : MEDIA_STATES.unavailable,
        error: failures.map((result) => result.reason?.message || String(result.reason)).join("; ")
      });
    });

    return () => {
      active = false;
    };
  }, [key, retryNonce]);

  return {
    ...state,
    retry: () => setRetryNonce((current) => current + 1)
  };
}

function resolvedMediaStatus(sources, resolverStates) {
  if (sources.length) {
    return sourceAvailabilityState(sources[0]);
  }

  if (resolverStates.some((state) => state.loading || state.status === MEDIA_STATES.resolving)) {
    return MEDIA_STATES.resolving;
  }

  if (resolverStates.some((state) => state.status === MEDIA_STATES.failed)) {
    return MEDIA_STATES.failed;
  }

  if (resolverStates.some((state) => state.settled || state.status === MEDIA_STATES.unavailable)) {
    return MEDIA_STATES.unavailable;
  }

  return MEDIA_STATES.idle;
}

function useActivityMedia(activity, { logFailures = false } = {}) {
  const media = useMemo(() => collectMedia(activity), [activity]);
  const debugContext = useMemo(() => ({
    activityId: activity?.id || null,
    mediaFieldsAvailable: mediaFieldsAvailable(activity || {}),
    logFailures
  }), [activity, logFailures]);
  const resolvedInputImages = useResolvedTelegramSources(media.inputImageFileCandidates, "input", {
    ...debugContext,
    attemptedSource: "input Telegram file ID",
    hasTraceFallback: false
  });
  const resolvedSentPhotos = useResolvedTelegramSources(media.sentPhotoFileCandidates, "telegram", {
    ...debugContext,
    attemptedSource: "sent Telegram photo file ID",
    hasTraceFallback: media.resultImageFallbackSources.length > 0
  });
  const resolvedVideos = useResolvedTelegramSources(media.videoFileCandidates, "telegram", {
    ...debugContext,
    mediaRole: "video",
    attemptedSource: "sent Telegram video or animation file ID",
    hasTraceFallback: media.resultVideoFallbackSources.length > 0
  });
  const inputImageSources = uniqueMediaSources([
      ...resolvedInputImages.sources,
      ...media.inputImageFallbackSources
    ]);
  const telegramImageSources = uniqueMediaSources([
      ...resolvedSentPhotos.sources,
      ...media.telegramImageSources
    ]);
  const resultImageSources = uniqueMediaSources([
      ...media.resultImageFallbackSources,
      ...telegramImageSources
    ]);
  const telegramVideoSources = uniqueMediaSources([
      ...resolvedVideos.sources,
      ...media.telegramVideoSources
    ]);
  const traceVideoFallbackAllowed = canUseFallbackAfterTelegram({
    hasTelegramFileId: media.videoFileCandidates.length > 0,
    resolvedSources: telegramVideoSources,
    resolverState: resolvedVideos
  });
  const rawVideoSources = uniqueMediaSources([
      ...telegramVideoSources,
      ...(traceVideoFallbackAllowed ? media.resultVideoFallbackSources : [])
    ]);
  const {
    validSources: videoSources,
    invalidSources: invalidVideoSources
  } = splitPlayableVideoSources(rawVideoSources);
  const videoFallbackUrl = rawVideoSources.find((source) => /^https?:\/\//i.test(source.url))?.url || "";
  const inputImageLoading = resolvedInputImages.loading;
  const imageLoading = resolvedSentPhotos.loading && !telegramImageSources.length;
  const videoLoading = resolvedVideos.loading;
  const inputImageStatus = resolvedMediaStatus(inputImageSources, [resolvedInputImages]);
  const imageStatus = resolvedMediaStatus(resultImageSources, [resolvedSentPhotos]);
  const baseVideoStatus = resolvedMediaStatus(videoSources, [resolvedVideos]);
  const videoStatus = videoSources.length
    ? baseVideoStatus
    : videoLoading
      ? MEDIA_STATES.resolving
      : invalidVideoSources.length
        ? MEDIA_STATES.failed
        : baseVideoStatus;
  const shouldShowResultImage = resultImageSources.length > 0 && !videoSources.length && videoStatus !== MEDIA_STATES.resolving;
  const hasVideoMedia = media.videoFileCandidates.length > 0 || media.telegramVideoSources.length > 0 || media.resultVideoFallbackSources.length > 0;
  const selectedVideoSource = videoSources[0] || null;
  const selectedImageSource = resultImageSources[0] || null;
  const videoValidationError = invalidVideoSources.map(invalidVideoReason).join("; ");
  const videoFailureReason = resolvedVideos.error ? mediaFailureReason(resolvedVideos.error) : videoValidationError;
  const videoFallbackDecision = selectedVideoSource?.kind === "telegram"
    ? MEDIA_STATES.telegramAvailable
    : selectedVideoSource?.kind === "trace"
      ? MEDIA_STATES.traceFallback
      : videoStatus;
  const imageFallbackDecision = selectedImageSource?.kind === "telegram"
    ? MEDIA_STATES.telegramAvailable
    : selectedImageSource?.kind === "trace"
      ? MEDIA_STATES.traceFallback
      : imageStatus;

  return {
    inputImageSources,
    imageSources: resultImageSources,
    posterSources: videoSources.length ? media.resultImageFallbackSources : [],
    previewImageSources: uniqueMediaSources([
      ...resultImageSources,
      ...(shouldShowResultImage ? media.resultImageFallbackSources : [])
    ]),
    videoSources,
    rawVideoSources,
    invalidVideoSources,
    videoFallbackUrl,
    inputImageStatus,
    imageStatus,
    videoStatus,
    inputImageLoading,
    imageLoading,
    videoLoading,
    inputImageError: resolvedInputImages.error,
    imageError: resolvedSentPhotos.error,
    videoError: [resolvedVideos.error, videoValidationError].filter(Boolean).join("; "),
    videoFailureReason,
    retryInputImages: resolvedInputImages.retry,
    retryImages: resolvedSentPhotos.retry,
    retryVideos: resolvedVideos.retry,
    hasTelegramVideoFileId: media.videoFileCandidates.length > 0,
    hasTelegramImageFileId: media.sentPhotoFileCandidates.length > 0,
    hasTelegramInputImageFileId: media.inputImageFileCandidates.length > 0,
    hasVideoMedia,
    shouldShowResultImage,
    videoFallbackDecision,
    imageFallbackDecision,
    mediaSelectionDebug: media.selectionDebug,
    selectedVideoFieldName: selectedVideoSource?.fieldName || media.videoFileCandidates[0]?.fieldName || rawVideoSources[0]?.fieldName || null,
    selectedVideoFileIdOrUrl: selectedVideoSource?.url || media.videoFileCandidates[0]?.fileId || rawVideoSources[0]?.url || null,
    resolvedVideoSource: resolvedSourceLabel(selectedVideoSource, {
      loading: videoLoading,
      hasTelegramFileId: media.videoFileCandidates.length > 0
    }),
    resolvedImageSource: resolvedSourceLabel(selectedImageSource, {
      loading: imageLoading,
      hasTelegramFileId: media.sentPhotoFileCandidates.length > 0
    })
  };
}

function useActivityCardPreviewMedia(activity) {
  const media = useMemo(() => collectMedia(activity), [activity]);
  const debugContext = useMemo(() => ({
    activityId: activity?.id || null,
    mediaFieldsAvailable: mediaFieldsAvailable(activity || {}),
    logFailures: false
  }), [activity]);
  const resolvedInputImages = useResolvedTelegramSources(media.inputImageFileCandidates, "input", {
    ...debugContext,
    attemptedSource: "activity card input Telegram file ID",
    hasTraceFallback: media.resultImageFallbackSources.length > 0
  });
  const resolvedSentPhotos = useResolvedTelegramSources(media.sentPhotoFileCandidates, "telegram", {
    ...debugContext,
    attemptedSource: "activity card sent Telegram photo file ID",
    hasTraceFallback: media.resultImageFallbackSources.length > 0
  });
  const sources = uniqueMediaSources([
    ...media.resultImageFallbackSources,
    ...resolvedInputImages.sources,
    ...resolvedSentPhotos.sources,
    ...media.inputImageFallbackSources,
    ...media.telegramImageSources
  ]);
  const loading = !sources.length && (resolvedInputImages.loading || resolvedSentPhotos.loading);
  const status = resolvedMediaStatus(sources, [resolvedInputImages, resolvedSentPhotos]);
  const retry = useCallback(() => {
    resolvedInputImages.retry();
    resolvedSentPhotos.retry();
  }, [resolvedInputImages.retry, resolvedSentPhotos.retry]);

  return {
    sources,
    loading,
    status,
    retry,
    hasVideo: media.videoFileCandidates.length || media.telegramVideoSources.length || media.resultVideoFallbackSources.length
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

function mediaStatusLabel(status) {
  if (status === MEDIA_STATES.resolving) {
    return "resolving";
  }

  if (status === MEDIA_STATES.telegramAvailable) {
    return "telegram_available";
  }

  if (status === MEDIA_STATES.traceFallback) {
    return "trace_fallback";
  }

  if (status === MEDIA_STATES.failed) {
    return "failed";
  }

  if (status === MEDIA_STATES.available) {
    return "available";
  }

  return MEDIA_SOURCE_LABELS.unavailable;
}

function MediaSourceBadge({ source, status = MEDIA_STATES.idle }) {
  const label = source ? mediaSourceLabel(source) : mediaStatusLabel(status);
  const className =
    status === MEDIA_STATES.failed
      ? "border-red-300/20 bg-red-400/10 text-red-100"
      : status === MEDIA_STATES.resolving
        ? "border-primary/24 bg-primary/10 text-primary"
        : source
          ? "border-primary/24 bg-primary/10 text-primary"
          : "border-line bg-ink/24 text-text/58";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${className}`}>
      {label}
    </span>
  );
}

function MediaFallback({
  reason = "preview_unavailable",
  status = MEDIA_STATES.unavailable,
  compact = false,
  title,
  fallbackUrl = "",
  onRetry
}) {
  const isResolving = status === MEDIA_STATES.resolving;
  const isFailed = status === MEDIA_STATES.failed;
  const resolvedTitle = title || (isResolving ? "Resolving media..." : isFailed ? "Could not load media" : "Media unavailable");
  const heightClass = compact ? "min-h-36" : "aspect-video";

  if (isResolving) {
    return (
      <div className={`${heightClass} skeleton-block grid place-items-center rounded-lg border border-line bg-ink/32 px-4 text-center`}>
        <div className="relative z-10">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <PlayCircle className="h-5 w-5 animate-pulse" />
          </div>
          <p className="mt-3 text-sm font-medium text-text">{resolvedTitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${heightClass} grid place-items-center rounded-lg border border-line bg-ink/28 px-4 py-6 text-center`}>
      <div>
        <div className={`mx-auto grid h-10 w-10 place-items-center rounded-md border ${isFailed ? "border-red-300/18 bg-red-400/10 text-red-200" : "border-line bg-ink/32 text-text/48"}`}>
          <ImageOff className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-text">{resolvedTitle}</p>
        <p className="mt-1 text-xs text-text/46">{reason || MEDIA_SOURCE_LABELS.unavailable}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {isFailed && onRetry ? (
            <button className={buttonClass} type="button" onClick={onRetry}>
              Retry media
            </button>
          ) : null}
          {fallbackUrl ? (
            <a className={`${buttonClass} inline-flex items-center gap-2`} href={fallbackUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open fallback URL
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProgressiveImage({ sources, alt, loading = false, status = MEDIA_STATES.idle, reason, className = "aspect-video w-full rounded-lg border border-line object-cover", onOpenImage, onRetry }) {
  const safeSources = uniqueMediaSources(sources);
  const sourceKey = safeSources.map((source) => source.url).join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [sourceKey]);

  const src = safeSources[index]?.url;

  if (!src) {
    const fallbackStatus = loading
      ? MEDIA_STATES.resolving
      : safeSources.length
        ? MEDIA_STATES.failed
        : status === MEDIA_STATES.idle
          ? MEDIA_STATES.unavailable
          : status;

    return (
      <MediaFallback
        status={fallbackStatus}
        reason={fallbackStatus === MEDIA_STATES.failed ? "Image source could not be loaded." : reason}
        onRetry={() => {
          setIndex(0);
          onRetry?.();
        }}
      />
    );
  }

  const image = (
    <img
      className={`${className} block ${onOpenImage ? "cursor-zoom-in" : ""}`}
      src={src}
      alt={alt}
      onError={() => setIndex((current) => current + 1)}
    />
  );

  if (!onOpenImage) {
    return image;
  }

  return (
    <button
      type="button"
      className="block w-full cursor-zoom-in overflow-hidden text-left"
      onClick={() => onOpenImage({ src, alt })}
      aria-label={`Open ${alt || "image preview"}`}
    >
      {image}
    </button>
  );
}

function MediaImage({ label, sources, alt, loading, status = MEDIA_STATES.idle, reason, showFallback = false, onOpenImage, onRetry }) {
  const safeSources = uniqueMediaSources(sources);

  if (!safeSources.length && !loading && !showFallback) {
    return null;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-text/38">{label}</p>
        <MediaSourceBadge source={safeSources[0]} status={status} />
      </div>
      <ProgressiveImage sources={safeSources} alt={alt} loading={loading} status={status} reason={reason} onOpenImage={onOpenImage} onRetry={onRetry} />
    </div>
  );
}

function videoMimeType(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".webm")) {
      return "video/webm";
    }

    if (pathname.endsWith(".mov")) {
      return "video/quicktime";
    }
  } catch {
    return "video/mp4";
  }

  return "video/mp4";
}

function PlyrVideoPlayer({ src, poster, activityId, source, onReady, onError }) {
  const mountRef = useRef(null);

  useLayoutEffect(() => {
    const mount = mountRef.current;

    if (!mount || !src) {
      return undefined;
    }

    let active = true;
    let player = null;
    const video = document.createElement("video");
    const sourceNode = document.createElement("source");

    video.className = "h-full w-full";
    video.playsInline = true;
    video.controls = true;
    video.preload = "metadata";
    if (poster) {
      video.poster = poster;
    }

    sourceNode.src = src;
    sourceNode.type = videoMimeType(src);
    sourceNode.setAttribute("size", "720");
    video.appendChild(sourceNode);
    mount.replaceChildren(video);

    const handleReady = () => {
      if (active) {
        onReady?.();
      }
    };
    const handleError = (event) => {
      if (active) {
        onError?.(event instanceof Error ? event : new Error("Video source could not be loaded."));
      }
    };

    try {
      player = new Plyr(video, {
        theme: "dark",
        controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
        settings: ["quality", "speed"],
        quality: {
          default: 720,
          options: [1080, 720, 480, 360]
        }
      });

      player.on("ready", handleReady);
      player.on("error", handleError);
      video.addEventListener("loadedmetadata", handleReady);
      video.addEventListener("canplay", handleReady);
      video.addEventListener("error", handleError, true);
    } catch (error) {
      safeAddDeveloperConsoleEntry({
        source: "activity video player",
        method: "MEDIA",
        url: `activity://${activityId || "unknown"}`,
        status: "video-player-failed",
        ok: false,
        requestPayload: {
          activityId: activityId || null,
          mediaType: "video",
          sourceUrl: src,
          attemptedSource: mediaSourceLabel(source)
        },
        errorJson: {
          message: error.message,
          exactError: error.message
        }
      });
      handleError(error);
    }

    return () => {
      active = false;
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError, true);

      try {
        player?.off?.("ready", handleReady);
        player?.off?.("error", handleError);
        player?.destroy();
      } catch (error) {
        console.warn("Video player cleanup failed.", error);
      }

      if (mountRef.current) {
        try {
          mountRef.current.replaceChildren();
        } catch (error) {
          console.warn("Video player mount cleanup failed.", error);
        }
      }
    };
  }, [activityId, onError, onReady, poster, source?.kind, src]);

  return <div ref={mountRef} className="h-full w-full" />;
}

function VideoPreview({
  sources,
  posterSources = [],
  invalidSources = [],
  fallbackUrl = "",
  loading,
  status = MEDIA_STATES.idle,
  onRetry,
  activityId,
  title,
  time
}) {
  const playableVideoSplit = splitPlayableVideoSources(sources);
  const safeSources = playableVideoSplit.validSources;
  const allInvalidSources = [...(Array.isArray(invalidSources) ? invalidSources : []), ...playableVideoSplit.invalidSources];
  const safePosterSources = uniqueMediaSources(posterSources);
  const sourceKey = safeSources.map((source) => source.url).join("|");
  const invalidSourceKey = allInvalidSources.map((entry) => `${entry?.source?.fieldName || entry?.source?.url || "unknown"}:${entry?.reason || ""}`).join("|");
  const posterKey = safePosterSources.map((source) => source.url).join("|");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [posterIndex, setPosterIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const source = safeSources[sourceIndex];
  const src = source?.url;
  const poster = safePosterSources[posterIndex]?.url || "";
  const fallbackVideoUrl = fallbackUrl || allInvalidSources.find((entry) => /^https?:\/\//i.test(entry?.source?.url || ""))?.source?.url || "";
  const invalidReason = allInvalidSources.map(invalidVideoReason).join("; ");
  const playerKey = `${activityId || "unknown"}:${src || "no-source"}`;
  const emptyStatus = loading
    ? MEDIA_STATES.resolving
    : status === MEDIA_STATES.idle
      ? MEDIA_STATES.unavailable
      : status;

  useEffect(() => {
    setSourceIndex(0);
    setVideoFailed(false);
    setReady(false);
  }, [sourceKey]);

  useEffect(() => {
    setPosterIndex(0);
  }, [posterKey]);

  useEffect(() => {
    setDownloadStatus("");
    setDownloading(false);
  }, [src]);

  useEffect(() => {
    if (!allInvalidSources.length) {
      return;
    }

    allInvalidSources.forEach((entry) => {
      const reason = invalidVideoReason(entry);

      safeAddDeveloperConsoleEntry({
        source: "activity video resolver",
        method: "MEDIA",
        url: `activity://${activityId || "unknown"}`,
        status: "video-source-invalid",
        ok: false,
        requestPayload: {
          activityId: activityId || null,
          mediaType: "video",
          chosenVideoFieldName: entry?.source?.fieldName || null,
          chosenFileIdOrUrl: entry?.source?.url || null,
        endpointCalled: null,
        finalResolvedVideoUrl: null,
        resolverStatus: MEDIA_STATES.failed,
        playerStatus: null,
        fallbackUsed: false,
        failureReason: reason
      },
      errorJson: {
        exactError: reason,
        failureReason: reason,
        resolverStatus: MEDIA_STATES.failed,
        playerStatus: null,
        fallbackUsed: false,
        resolverState: MEDIA_STATES.failed,
        finalResolvedVideoUrl: null
      }
      });
    });
  }, [activityId, invalidSourceKey]);

  const handlePlayerReady = useCallback(() => {
    setReady(true);
  }, []);

  const handlePlayerError = useCallback((error) => {
    setReady(false);
    safeAddDeveloperConsoleEntry({
      source: "activity video player",
      method: "MEDIA",
      url: `activity://${activityId || "unknown"}`,
      status: "video-source-failed",
      ok: false,
      requestPayload: {
        activityId: activityId || null,
        mediaType: "video",
        selectedSource: source?.kind || null,
        chosenVideoFieldName: source?.fieldName || null,
        chosenFileIdOrUrl: src || null,
        endpointCalled: null,
        finalResolvedVideoUrl: src || null,
        resolverStatus: source?.kind === "telegram" ? MEDIA_STATES.telegramAvailable : source?.kind === "trace" ? MEDIA_STATES.traceFallback : MEDIA_STATES.available,
        playerStatus: "player_failed",
        fallbackUsed: source?.kind !== "telegram",
        sourceUrl: src,
        fallbackDecision: sourceIndex < safeSources.length - 1 ? "next_source" : MEDIA_STATES.failed
      },
      errorJson: {
        exactError: error?.message || "Video source could not be loaded.",
        failureReason: "player_failed",
        resolverStatus: source?.kind === "telegram" ? MEDIA_STATES.telegramAvailable : source?.kind === "trace" ? MEDIA_STATES.traceFallback : MEDIA_STATES.available,
        playerStatus: "player_failed",
        fallbackUsed: source?.kind !== "telegram",
        resolverState: MEDIA_STATES.failed,
        finalResolvedVideoUrl: src || null,
        fallbackDecision: sourceIndex < safeSources.length - 1 ? "next_source" : MEDIA_STATES.failed
      }
    });

    if (sourceIndex < safeSources.length - 1) {
      setSourceIndex((current) => current + 1);
      return;
    }

    setVideoFailed(true);
  }, [activityId, safeSources.length, source?.kind, sourceIndex, src]);

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

  function retryVideo() {
    setSourceIndex(0);
    setVideoFailed(false);
    setReady(false);
    onRetry?.();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-text/38">Video preview</p>
        <MediaSourceBadge source={source} status={videoFailed ? MEDIA_STATES.failed : emptyStatus} />
      </div>
      {!src ? (
        <MediaFallback
          compact
          status={emptyStatus}
          title="Video unavailable"
          reason={emptyStatus === MEDIA_STATES.failed ? invalidReason || "No playable video source resolved." : "No video source is attached to this activity."}
          fallbackUrl={fallbackVideoUrl}
          onRetry={retryVideo}
        />
      ) : videoFailed ? (
        <div className="rounded-lg border border-line bg-ink/28 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-red-300/18 bg-red-400/10 text-red-200">
                <PlayCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-text">Video player could not load this source.</p>
                <p className="mt-1 truncate text-xs text-text/46">{src}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className={`${buttonClass} inline-flex items-center gap-2`} href={src} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open video
              </a>
              <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={handleDownload} disabled={downloading}>
                <Download className="h-4 w-4" />
                {downloading ? "Preparing..." : "Download video"}
              </button>
              <button className={buttonClass} type="button" onClick={retryVideo}>
                Retry media
              </button>
            </div>
          </div>
          {downloadStatus ? <p className="mt-3 text-sm text-text/58">{downloadStatus}</p> : null}
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-lg border border-line bg-black">
            <div className="aspect-video">
              <PlyrVideoPlayer
                key={playerKey}
                src={src}
                poster={poster}
                activityId={activityId}
                source={source}
                onReady={handlePlayerReady}
                onError={handlePlayerError}
              />
            </div>
            {!ready ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/32 text-sm text-text/72">
                Preparing player...
              </div>
            ) : null}
          </div>
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
        </>
      )}
    </div>
  );
}

function ActivityDetails({ activity, onClose, onOpenImage }) {
  const media = useActivityMedia(activity || {}, { logFailures: true });

  useEffect(() => {
    if (!activity) {
      return;
    }

    const previewExtraction = {
      url: activity.inputUrl || null,
      domain: activity.inputSourceDomain || null,
      extractorUsed: activity.previewExtractionMethod || null,
      imageCandidateCount: activity.previewExtractionCandidateCount ?? null,
      selectedImageUrl: activity.extractedImageUrl || activity.media?.extractedImageUrl || null,
      failureReason: activity.previewExtractionError || null,
      status: activity.previewExtractionStatus || null,
      sourceType: activity.sourceType || activity.source || null
    };

    safeAddDeveloperConsoleEntry({
      source: "activity media resolver",
      method: "MEDIA",
      url: `activity://${activity.id}`,
      status: "media-state",
      ok: true,
      resolvedVideoSource: media.resolvedVideoSource,
      resolvedImageSource: media.resolvedImageSource,
      requestPayload: {
        activityId: activity.id,
        hasTelegramVideoFileId: media.hasTelegramVideoFileId,
        hasTelegramImageFileId: media.hasTelegramImageFileId,
        hasTelegramInputImageFileId: media.hasTelegramInputImageFileId,
        selectedVideoSource: media.videoSources[0]?.kind || null,
        selectedImageSource: media.imageSources[0]?.kind || null,
        chosenVideoFieldName: media.selectedVideoFieldName,
        chosenFileIdOrUrl: media.selectedVideoFileIdOrUrl,
        endpointCalled: media.videoSources[0]?.kind === "telegram" ? "resolved_by_telegram_file_endpoint" : null,
        finalResolvedVideoUrl: media.videoSources[0]?.url || null,
        failureReason: media.videoFailureReason || media.videoError || null,
        exactError: media.videoError || null,
        selectionDebug: media.mediaSelectionDebug,
        inputImageStatus: media.inputImageStatus,
        imageStatus: media.imageStatus,
        videoStatus: media.videoStatus,
        videoFallbackDecision: media.videoFallbackDecision,
        imageFallbackDecision: media.imageFallbackDecision,
        previewExtraction,
        invalidVideoSources: media.invalidVideoSources.map((entry) => ({
          fieldName: entry.source?.fieldName || null,
          url: entry.source?.url || null,
          reason: entry.reason
        }))
      },
      responseJson: {
        resolvedVideoSource: media.resolvedVideoSource,
        resolvedImageSource: media.resolvedImageSource,
        finalResolvedVideoUrl: media.videoSources[0]?.url || null,
        chosenVideoFieldName: media.selectedVideoFieldName,
        chosenFileIdOrUrl: media.selectedVideoFileIdOrUrl,
        selectionDebug: media.mediaSelectionDebug,
        videoSourceKind: media.videoSources[0]?.kind || null,
        imageSourceKind: media.imageSources[0]?.kind || null,
        videoResolverState: media.videoStatus,
        imageResolverState: media.imageStatus,
        videoFallbackDecision: media.videoFallbackDecision,
        imageFallbackDecision: media.imageFallbackDecision,
        previewExtraction,
        inputImageError: media.inputImageError || null,
        imageError: media.imageError || null,
        videoError: media.videoError || null,
        failureReason: media.videoFailureReason || media.videoError || null,
        exactError: media.videoError || null,
        videoFallbackUrl: media.videoFallbackUrl || null
      }
    });
  }, [
    activity?.id,
    media.resolvedVideoSource,
    media.resolvedImageSource,
    media.inputImageStatus,
    media.imageStatus,
    media.videoStatus,
    media.hasTelegramVideoFileId,
    media.hasTelegramImageFileId,
    media.hasTelegramInputImageFileId,
    media.videoFallbackDecision,
    media.imageFallbackDecision,
    media.selectedVideoFieldName,
    media.selectedVideoFileIdOrUrl,
    media.mediaSelectionDebug,
    media.videoError,
    media.videoFailureReason,
    media.videoFallbackUrl,
    media.videoSources[0]?.kind,
    media.videoSources[0]?.url,
    media.imageSources[0]?.kind,
    activity?.inputUrl,
    activity?.inputSourceDomain,
    activity?.previewExtractionMethod,
    activity?.previewExtractionCandidateCount,
    activity?.extractedImageUrl,
    activity?.media?.extractedImageUrl,
    activity?.previewExtractionError,
    activity?.previewExtractionStatus,
    activity?.sourceType,
    activity?.source
  ]);

  if (!activity) {
    return null;
  }

  const user = displayUser(activity);
  const botResponse = activity.botResponse && typeof activity.botResponse === "object" ? activity.botResponse : {};
  const similarity = botResponse.similarity ?? activity.similarity;
  const reason = failureLabel(activity);
  const showVideoPreview = media.hasVideoMedia || !media.shouldShowResultImage;

  return (
    <Drawer
      open={Boolean(activity)}
      eyebrow="Activity details"
      title={activity.animeTitle || botResponse.title || "Unresolved activity"}
      description={`${normalizeActivityStatus(activity.status)} / ${formatDate(activity.createdAt)}`}
      widthClass="max-w-3xl"
      onClose={onClose}
    >
      <div className="space-y-6">
        <section className="space-y-4 rounded-lg border border-line bg-ink/24 p-4">
          <div>
            <h3 className="font-medium text-text">Preview Media</h3>
            <p className="mt-1 text-xs text-text/42">Original input and matched video resolve independently.</p>
          </div>
          <ActivityMediaPreviewBoundary activity={activity} resetKey={`${activity.id || "unknown"}:${media.videoSources[0]?.url || "no-video"}:${media.imageSources[0]?.url || "no-image"}`}>
            <MediaImage
              label="Original image"
              sources={media.inputImageSources}
              alt="Original user input"
              loading={media.inputImageLoading}
              status={media.inputImageStatus}
              reason={media.inputImageError || reason}
              showFallback
              onOpenImage={onOpenImage}
              onRetry={media.retryInputImages}
            />
            {showVideoPreview ? (
              <VideoPreview
                sources={media.videoSources}
                posterSources={media.posterSources}
                invalidSources={media.invalidVideoSources}
                fallbackUrl={media.videoFallbackUrl}
                loading={media.videoLoading}
                status={media.videoStatus}
                onRetry={media.retryVideos}
                activityId={activity.id}
                title={activity.animeTitle || botResponse.title}
                time={activity.formattedTime || botResponse.time}
              />
            ) : null}
            {media.shouldShowResultImage ? (
              <MediaImage
                label={media.hasVideoMedia ? "Fallback preview" : "Result preview"}
                sources={media.imageSources}
                alt="Result media preview"
                loading={media.imageLoading}
                status={media.imageStatus}
                reason={media.imageError || reason}
                onOpenImage={onOpenImage}
                onRetry={media.retryImages}
              />
            ) : null}
          </ActivityMediaPreviewBoundary>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-ink/24 p-4">
          <h3 className="font-medium text-text">Match Summary</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Anime title" value={botResponse.title || activity.animeTitle} />
            <DetailRow label="Similarity" value={similarity !== null && similarity !== undefined ? `${similarity}%` : null} />
            <DetailRow label="Episode" value={botResponse.episode ?? activity.episode} />
            <DetailRow label="Time range" value={botResponse.time || activity.formattedTime} />
            <DetailRow label="AniList" value={activity.anilistUrl ? "Open AniList" : null} href={activity.anilistUrl} />
            <DetailRow label="Activity status" value={normalizeActivityStatus(activity.status)} />
            <DetailRow label="Reason" value={activity.rejectionReason || activity.error} />
            <DetailRow label="Created" value={formatDate(activity.createdAt)} />
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-ink/24 p-4">
          <h3 className="font-medium text-text">User Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Display name" value={user.displayName} />
            <DetailRow label="Username" value={user.username ? `@${user.username}` : null} />
            <DetailRow label="Telegram ID" value={user.telegramId} />
            <DetailRow label="Source type" value={activity.inputType || activity.source} />
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-ink/24 p-4">
          <h3 className="font-medium text-text">Input Information</h3>
          <div className="grid gap-4">
            <DetailRow label="Original submitted URL" value={activity.inputUrl} href={activity.inputUrl} />
            <DetailRow
              label="Extracted preview image URL"
              value={activity.extractedImageUrl || activity.media?.extractedImageUrl}
              href={activity.extractedImageUrl || activity.media?.extractedImageUrl}
            />
            <DetailRow label="Source domain" value={activity.inputSourceDomain || activity.userInput?.inputSourceDomain} />
            <DetailRow label="Extraction method" value={activity.previewExtractionMethod} />
            <DetailRow label="Extraction status" value={activity.previewExtractionStatus} />
            <DetailRow label="Extraction error" value={activity.previewExtractionError} />
            <DetailRow label="Input file ID" value={activity.inputFileId || activity.media?.inputTelegramFileId} />
            <DetailRow label="Message text" value={activity.userInput?.text} />
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-ink/24 p-4">
          <h3 className="font-medium text-text">Bot Output</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Sent video file ID" value={activity.sentVideoFileId || activity.sentAnimationFileId || activity.media?.sentVideoFileId || activity.media?.sentAnimationFileId} />
            <DetailRow label="Resolved video source" value={media.resolvedVideoSource} />
            <DetailRow label="Resolved image source" value={media.resolvedImageSource} />
            <DetailRow label="Message" value={botResponse.message} />
          </div>
        </section>

        <RawJsonViewer value={activity} />
      </div>
    </Drawer>
  );
}

function ActivityCard({ activity, selectMode, selected, onSelect, onOpen, onDelete }) {
  const previewMedia = useActivityCardPreviewMedia(activity);
  const user = displayUser(activity);
  const reason = failureLabel(activity);
  const similarity = activity.similarity ?? activity.botResponse?.similarity;

  return (
    <article
      className="interactive-card cursor-pointer overflow-hidden rounded-lg border border-line bg-panel text-left"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
    >
      <div className="relative">
        <ProgressiveImage
          sources={previewMedia.sources}
          alt="Activity preview"
          loading={previewMedia.loading}
          status={previewMedia.status}
          reason={reason}
          className="aspect-[20/9] w-full object-cover"
          onRetry={previewMedia.retry}
        />
        {previewMedia.hasVideo ? (
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-ink/80 px-2 py-1 text-xs font-medium text-primary backdrop-blur">
            <PlayCircle className="h-3.5 w-3.5 fill-current" />
            Video
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 min-h-10 font-medium leading-5 text-text">{activity.animeTitle || activity.botResponse?.title || "No match"}</p>
          <StatusPill status={normalizeActivityStatus(activity.status)} />
        </div>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-text/42">Similarity</span>
            <span className="font-medium text-primary">{similarity !== null && similarity !== undefined ? `${similarity}%` : "-"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text/42">User</span>
            <span className="truncate text-right text-text/72">{user.displayName}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text/42">Created</span>
            <span className="text-right text-text/58">{formatDate(activity.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectMode ? (
            <label className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-text/72" onClick={(event) => event.stopPropagation()}>
              <input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} />
              Select
            </label>
          ) : null}
          <button className={buttonClass} type="button" onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}>
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
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [lightboxImage, setLightboxImage] = useState(null);

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
  const visibleActivityIds = useMemo(() => filtered.map((activity) => activity.id).filter(Boolean), [filtered]);

  useEffect(() => {
    if (!selectMode) {
      return;
    }

    const visibleIds = new Set(visibleActivityIds);
    setSelectedActivityIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [selectMode, visibleActivityIds]);

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
          {!selectMode ? (
            <button className={buttonClass} type="button" onClick={() => setSelectMode(true)}>
              Select
            </button>
          ) : null}
          <input className={inputClass} placeholder="Search activities" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {selectMode ? (
        <SelectionToolbar
          selectedCount={selectedActivityIds.length}
          totalVisibleCount={visibleActivityIds.length}
          onSelectAll={() => setSelectedActivityIds(visibleActivityIds)}
          onClear={() => setSelectedActivityIds([])}
          onDeleteSelected={() => requestDelete(selectedActivityIds)}
          onCancel={cancelSelection}
          isDeleting={deleting}
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title="No activities found" detail={activities.data.some(isTechnicalFailure) ? "Technical failures are routed to Errors." : null} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              selectMode={selectMode}
              selected={selectedActivityIds.includes(activity.id)}
              onSelect={(checked) => toggleSelected(activity.id, checked)}
              onOpen={() => setSelectedActivity(activity)}
              onDelete={() => requestDelete([activity.id])}
              onOpenImage={setLightboxImage}
            />
          ))}
        </div>
      )}

      {selectedActivity ? (
        <ActivityPreviewBoundary
          activity={selectedActivity}
          resetKey={selectedActivity.id || JSON.stringify(mediaFieldsAvailable(selectedActivity))}
          onClose={() => setSelectedActivity(null)}
        >
          <ActivityDetails activity={selectedActivity} onClose={() => setSelectedActivity(null)} onOpenImage={setLightboxImage} />
        </ActivityPreviewBoundary>
      ) : null}
      <ImageLightbox
        src={lightboxImage?.src}
        alt={lightboxImage?.alt}
        onClose={() => setLightboxImage(null)}
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
