export const TECHNICAL_FAILURE_TYPES = new Set([
  "invalid_media",
  "unsupported_source",
  "invalid_url",
  "processing_error",
  "telegram_download_error",
  "trace_api_error"
]);

export function normalizeActivityStatus(status) {
  if (status === "low_similarity") {
    return "rejected";
  }

  if (status === "error") {
    return "failed";
  }

  return status || "unknown";
}

export function getFailureType(record = {}) {
  return record.failureType || record.errorType || record.rejectionReason || record.reason || null;
}

export function isTechnicalFailure(record = {}) {
  return TECHNICAL_FAILURE_TYPES.has(getFailureType(record));
}

export function failureLabel(record = {}) {
  return getFailureType(record) || record.error || record.message || "media_unavailable";
}
