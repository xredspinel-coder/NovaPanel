import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const TRACE_MOE_MEDIA_PATTERN = /^https:\/\/api\.trace\.moe\/(?:image|video)\//i;

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function firstPresent(...values) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed) {
        return trimmed;
      }
    } else if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function sourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isTraceMoeMediaUrl(url) {
  return typeof url === "string" && TRACE_MOE_MEDIA_PATTERN.test(url.trim());
}

function firstNonTraceUrl(...values) {
  return firstPresent(...values.filter((value) => !isTraceMoeMediaUrl(value)));
}

function buildInput(activity) {
  const input = asRecord(activity.input);
  const media = asRecord(activity.media);
  const userInput = asRecord(activity.userInput);
  const url = firstPresent(input.url, activity.inputUrl, userInput.url);
  const telegramFileId = firstPresent(
    input.telegramFileId,
    media.inputTelegramFileId,
    activity.inputTelegramFileId,
    activity.inputFileId,
    userInput.fileId
  );

  return {
    type: firstPresent(input.type, activity.inputType, activity.source),
    source: firstPresent(input.source, activity.source),
    sourceType: firstPresent(input.sourceType, activity.sourceType, activity.source),
    text: firstPresent(input.text, userInput.text, typeof activity.userInput === "string" ? activity.userInput : null),
    url,
    domain: firstPresent(input.domain, activity.inputSourceDomain, userInput.inputSourceDomain, sourceDomain(url)),
    telegramFileId,
    telegramFileUrl: telegramFileId ? null : firstPresent(input.telegramFileUrl, media.inputTelegramFileUrl, activity.inputTelegramFileUrl),
    thumbnail: firstNonTraceUrl(input.thumbnail, activity.inputThumbnail, media.inputThumbnail),
    preview: firstNonTraceUrl(input.preview, activity.inputPreview, media.inputImageUrl, activity.inputImageUrl),
    extractedImageUrl: firstNonTraceUrl(input.extractedImageUrl, activity.extractedImageUrl, media.extractedImageUrl),
    selectedImageUrl: firstNonTraceUrl(input.selectedImageUrl, activity.selectedImageUrl, activity.extractedImageUrl, media.extractedImageUrl),
    bestImageUrl: firstNonTraceUrl(input.bestImageUrl, activity.bestImageUrl, media.bestImageUrl),
    telegramPreviewUsed: Boolean(input.telegramPreviewUsed || activity.telegramPreviewUsed || activity.fallbackUsed === "telegram_preview"),
    provider: firstPresent(input.provider, activity.provider, activity.providerDiagnostics?.platform),
    providerDiagnostics: input.providerDiagnostics || activity.providerDiagnostics || null,
    imageCount: activity.imageCount ?? input.imageCount ?? activity.previewExtractionCandidateCount ?? null,
    filteredImageCount: activity.filteredImageCount ?? input.filteredImageCount ?? null
  };
}

function buildResult(activity) {
  const result = asRecord(activity.result);
  const botResponse = asRecord(activity.botResponse);

  return {
    animeTitle: firstPresent(result.animeTitle, activity.animeTitle, botResponse.title),
    anilistId: result.anilistId ?? activity.anilistId ?? null,
    anilistUrl: firstPresent(result.anilistUrl, activity.anilistUrl, botResponse.anilistUrl),
    episode: result.episode ?? activity.episode ?? botResponse.episode ?? null,
    similarity: result.similarity ?? activity.similarity ?? botResponse.similarity ?? null,
    from: result.from ?? activity.from ?? null,
    to: result.to ?? activity.to ?? null,
    formattedTime: firstPresent(result.formattedTime, activity.formattedTime, botResponse.time)
  };
}

function buildTraceMoe(activity) {
  const traceMoe = asRecord(activity.traceMoe);
  const media = asRecord(activity.media);
  const botResponse = asRecord(activity.botResponse);

  return {
    imageUrl: firstPresent(
      traceMoe.imageUrl,
      isTraceMoeMediaUrl(media.resultImageUrl) ? media.resultImageUrl : null,
      isTraceMoeMediaUrl(activity.resultImageUrl) ? activity.resultImageUrl : null,
      isTraceMoeMediaUrl(activity.imageUrl) ? activity.imageUrl : null,
      isTraceMoeMediaUrl(botResponse.imageUrl) ? botResponse.imageUrl : null
    ),
    videoUrl: firstPresent(
      traceMoe.videoUrl,
      isTraceMoeMediaUrl(media.resultVideoUrl) ? media.resultVideoUrl : null,
      isTraceMoeMediaUrl(activity.resultVideoUrl) ? activity.resultVideoUrl : null,
      isTraceMoeMediaUrl(activity.videoUrl) ? activity.videoUrl : null,
      isTraceMoeMediaUrl(botResponse.videoUrl) ? botResponse.videoUrl : null
    ),
    raw: traceMoe.raw || activity.traceMoeRaw || null
  };
}

function buildMedia(activity, input) {
  const media = asRecord(activity.media);
  const selectedTelegramFileId = firstPresent(media.selectedTelegramFileId, activity.selectedTelegramFileId);
  const inputTelegramFileId = firstPresent(media.inputTelegramFileId, input.telegramFileId, activity.inputTelegramFileId, activity.inputFileId);
  const sentPhotoFileId = firstPresent(media.sentPhotoFileId, activity.sentPhotoFileId);
  const sentVideoFileId = firstPresent(media.sentVideoFileId, activity.sentVideoFileId);
  const sentAnimationFileId = firstPresent(media.sentAnimationFileId, activity.sentAnimationFileId);
  const dashboardImageFileId = firstPresent(media.dashboardImageFileId, selectedTelegramFileId, inputTelegramFileId, sentPhotoFileId);
  const dashboardVideoFileId = firstPresent(media.dashboardVideoFileId, sentVideoFileId, sentAnimationFileId);

  return {
    inputTelegramFileId: inputTelegramFileId || null,
    inputTelegramFileUrl: inputTelegramFileId ? null : firstPresent(media.inputTelegramFileUrl, activity.inputTelegramFileUrl),
    selectedTelegramFileId: selectedTelegramFileId || null,
    selectedTelegramFileUrl: selectedTelegramFileId ? null : firstPresent(media.selectedTelegramFileUrl, activity.selectedTelegramFileUrl),
    sentPhotoFileId: sentPhotoFileId || null,
    sentVideoFileId: sentVideoFileId || null,
    sentAnimationFileId: sentAnimationFileId || null,
    dashboardImageFileId: dashboardImageFileId || null,
    dashboardImageUrl: dashboardImageFileId ? null : firstNonTraceUrl(media.dashboardImageUrl, input.preview, input.thumbnail, input.selectedImageUrl),
    dashboardVideoFileId: dashboardVideoFileId || null,
    dashboardVideoUrl: dashboardVideoFileId ? null : firstNonTraceUrl(media.dashboardVideoUrl)
  };
}

export function migrateActivityRecord(id, activity = {}, { updatedAt = null } = {}) {
  const input = buildInput(activity);
  const result = buildResult(activity);
  const media = buildMedia(activity, input);
  const traceMoe = buildTraceMoe(activity);

  return {
    id: firstPresent(activity.id, id),
    userId: activity.userId ? String(activity.userId) : activity.user?.telegramId ? String(activity.user.telegramId) : null,
    user: activity.user || null,
    input,
    result,
    media,
    traceMoe,
    botResponse: activity.botResponse || null,
    status: activity.status === "error" ? "failed" : activity.status || "success",
    error: activity.error || null,
    rejectionReason: activity.rejectionReason || null,
    createdAt: activity.createdAt || null,
    updatedAt: updatedAt || activity.updatedAt || null,

    source: input.source,
    sourceType: input.sourceType,
    inputType: input.type,
    inputUrl: input.url,
    inputSourceDomain: input.domain,
    selectedImageUrl: input.selectedImageUrl,
    extractedImageUrl: input.extractedImageUrl,
    animeTitle: result.animeTitle,
    anilistId: result.anilistId,
    anilistUrl: result.anilistUrl,
    episode: result.episode,
    from: result.from,
    to: result.to,
    formattedTime: result.formattedTime,
    similarity: result.similarity,
    inputTelegramFileId: input.telegramFileId,
    inputFileId: input.telegramFileId
  };
}

export async function migrateActivities({ db, apply = false, FieldValue = null, logger = console } = {}) {
  if (!db) {
    throw new Error("Firestore db is required.");
  }

  const snapshot = await db.collection("activities").get();
  const updatedAt = apply && FieldValue?.serverTimestamp ? FieldValue.serverTimestamp() : null;
  let writes = 0;

  for (const doc of snapshot.docs) {
    const payload = migrateActivityRecord(doc.id, doc.data(), { updatedAt });

    if (apply) {
      await doc.ref.set(payload, { merge: true });
      writes += 1;
    }
  }

  logger.log(`${apply ? "apply" : "dry-run"}: scanned ${snapshot.docs.length} activities, wrote ${writes}.`);

  return {
    scanned: snapshot.docs.length,
    writes,
    mode: apply ? "apply" : "dry-run"
  };
}

function normalizePrivateKey(privateKey) {
  return privateKey ? privateKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n") : "";
}

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex < 1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const value = rawValue.replace(/^['"]|['"]$/g, "");

  return key ? [key, value] : null;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  content.split(/\r?\n/).forEach((line) => {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      return;
    }

    const [key, value] = parsed;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function loadLocalEnv() {
  [
    ".env.local",
    ".env",
    path.join("..", "AniSeekBot", ".env.local"),
    path.join("..", "AniSeekBot", ".env")
  ].forEach((envPath) => loadEnvFile(path.resolve(process.cwd(), envPath)));
}

async function loadFirestoreAdmin() {
  const admin = (await import("firebase-admin")).default;

  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    const credential = projectId && clientEmail && privateKey
      ? admin.credential.cert({ projectId, clientEmail, privateKey })
      : admin.credential.applicationDefault();

    admin.initializeApp({
      credential,
      projectId: projectId || undefined
    });
  }

  return {
    db: admin.firestore(),
    FieldValue: admin.firestore.FieldValue
  };
}

async function main() {
  loadLocalEnv();

  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run") || !apply;

  if (apply && process.argv.includes("--dry-run")) {
    throw new Error("Use either --dry-run or --apply, not both.");
  }

  const { db, FieldValue } = await loadFirestoreAdmin();
  await migrateActivities({
    db,
    apply: apply && !dryRun ? true : apply,
    FieldValue
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
