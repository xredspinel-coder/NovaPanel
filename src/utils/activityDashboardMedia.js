const TRACE_MOE_MEDIA_PATTERN = /^https:\/\/api\.trace\.moe\/(?:image|video)\//i;

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizeString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const normalized = normalizeString(value);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function uniqueFileCandidates(candidates) {
  const seen = new Set();
  const result = [];

  candidates.forEach((candidate) => {
    const fileId = normalizeString(candidate?.fileId || candidate);

    if (!fileId || seen.has(fileId)) {
      return;
    }

    seen.add(fileId);
    result.push({
      fileId,
      fieldName: candidate?.fieldName || null
    });
  });

  return result;
}

export function isTraceMoeMediaUrl(url) {
  return typeof url === "string" && TRACE_MOE_MEDIA_PATTERN.test(url.trim());
}

export function getActivityDashboardMedia(activity = {}) {
  const record = asRecord(activity);
  const input = asRecord(record.input);
  const media = asRecord(record.media);
  const imageUrls = uniqueStrings([
    media.dashboardImageUrl,
    input.preview,
    input.thumbnail,
    input.selectedImageUrl,
    record.inputPreview,
    record.inputThumbnail,
    record.selectedImageUrl
  ]).filter((url) => !isTraceMoeMediaUrl(url));
  const imageFileCandidates = uniqueFileCandidates([
    { fileId: media.dashboardImageFileId, fieldName: "media.dashboardImageFileId" },
    { fileId: media.selectedTelegramFileId, fieldName: "media.selectedTelegramFileId" },
    { fileId: media.inputTelegramFileId, fieldName: "media.inputTelegramFileId" },
    { fileId: input.telegramFileId, fieldName: "input.telegramFileId" },
    { fileId: record.inputTelegramFileId, fieldName: "inputTelegramFileId" },
    { fileId: record.inputFileId, fieldName: "inputFileId" }
  ]);
  const videoUrls = uniqueStrings([
    media.dashboardVideoUrl
  ]).filter((url) => !isTraceMoeMediaUrl(url));
  const videoFileCandidates = uniqueFileCandidates([
    { fileId: media.dashboardVideoFileId, fieldName: "media.dashboardVideoFileId" },
    { fileId: media.sentVideoFileId, fieldName: "media.sentVideoFileId" },
    { fileId: media.sentAnimationFileId, fieldName: "media.sentAnimationFileId" },
    { fileId: record.sentVideoFileId, fieldName: "sentVideoFileId" },
    { fileId: record.sentAnimationFileId, fieldName: "sentAnimationFileId" }
  ]);

  return {
    imageUrls,
    imageFileCandidates,
    videoUrls,
    videoFileCandidates,
    primaryImageUrl: imageUrls[0] || null,
    primaryImageFileId: imageFileCandidates[0]?.fileId || null,
    primaryVideoUrl: videoUrls[0] || null,
    primaryVideoFileId: videoFileCandidates[0]?.fileId || null
  };
}
