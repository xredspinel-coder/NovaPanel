const DIRECT_IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const TRACE_MOE_IMAGE_PATTERN = /^https:\/\/api\.trace\.moe\/image\//i;

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizeUrl(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function uniqueOrderedUrls(values) {
  const seen = new Set();
  const urls = [];

  values.forEach((value) => {
    const normalized = normalizeUrl(value);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    urls.push(normalized);
  });

  return urls;
}

export function isDirectActivityImageUrl(url) {
  const normalized = normalizeUrl(url);

  if (!normalized) {
    return false;
  }

  if (/^data:image\//i.test(normalized) || TRACE_MOE_IMAGE_PATTERN.test(normalized)) {
    return true;
  }

  try {
    const parsed = new URL(normalized);

    if (!["http:", "https:", "blob:"].includes(parsed.protocol)) {
      return false;
    }

    return DIRECT_IMAGE_EXTENSION_PATTERN.test(parsed.pathname);
  } catch {
    return DIRECT_IMAGE_EXTENSION_PATTERN.test(normalized);
  }
}

export function getActivityPreviewImageCandidates(activity = {}) {
  const record = asRecord(activity);
  const media = asRecord(record.media);
  const botResponse = asRecord(record.botResponse);

  return uniqueOrderedUrls([
    media.resultImageUrl,
    record.imageUrl,
    botResponse.imageUrl,
    media.botImageUrl,
    record.inputPreview,
    record.inputThumbnail,
    record.inputImageUrl,
    isDirectActivityImageUrl(record.inputUrl) ? record.inputUrl : null
  ]);
}

export function getActivityPreviewImage(activity = {}) {
  return getActivityPreviewImageCandidates(activity)[0] || null;
}
