import { addDeveloperConsoleEntry } from "./developerConsole.js";

const botApiBaseUrl = (import.meta.env.VITE_BOT_API_BASE_URL || "").replace(/\/+$/, "");

function compact(values) {
  return values.filter((value) => typeof value === "string" && value.trim());
}

export function uniqueStrings(values) {
  return [...new Set(compact(values))];
}

export function isTelegramFileUrl(url) {
  return /^https:\/\/api\.telegram\.org\/file\/bot/i.test(url);
}

export function canResolveTelegramFiles() {
  return Boolean(botApiBaseUrl);
}

export function telegramFileResolverUrl(fileId) {
  if (!botApiBaseUrl || !fileId) {
    return "";
  }

  return `${botApiBaseUrl}/api/telegram-file/${encodeURIComponent(fileId)}`;
}

function resolvedFileUrlFromResponse(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return null;
  }

  return responseJson.url ||
    responseJson.fileUrl ||
    responseJson.fileURL ||
    responseJson.downloadUrl ||
    responseJson.data?.url ||
    responseJson.result?.url ||
    responseJson.file?.url ||
    null;
}

function valuePreview(value) {
  const text = String(value || "");

  if (text.length <= 96) {
    return text;
  }

  return `${text.slice(0, 44)}...${text.slice(-24)}`;
}

export async function resolveTelegramFileUrl(fileId, meta = {}) {
  if (!botApiBaseUrl || !fileId) {
    return null;
  }

  const url = telegramFileResolverUrl(fileId);
  const requestTime = new Date().toISOString();
  const startedAt = performance.now();
  let responseJson = null;
  const requestPayload = {
    activityId: meta.activityId || null,
    mediaType: meta.mediaType || null,
    selectedSource: meta.selectedSource || "telegram",
    mediaRole: meta.mediaRole || null,
    fileId,
    fieldName: meta.fieldName || meta.chosenFieldName || null,
    selectedField: meta.fieldName || meta.chosenFieldName || null,
    selectedValuePreview: valuePreview(meta.chosenFileIdOrUrl || fileId),
    chosenFieldName: meta.chosenFieldName || meta.fieldName || null,
    chosenVideoFieldName: meta.chosenVideoFieldName || null,
    chosenFileIdOrUrl: meta.chosenFileIdOrUrl || null,
    endpointCalled: meta.endpointCalled || url,
    endpoint: meta.endpointCalled || url,
    requestStartedAt: requestTime,
    fileIdPresent: Boolean(fileId),
    resolverUrl: meta.resolverUrl || url,
    attempt: meta.attempt || null,
    maxAttempts: meta.maxAttempts || null,
    fallbackDecision: meta.fallbackDecision || null,
    fallbackUsed: false,
    fallbackReason: meta.fallbackReason || null,
    resolverStatus: "pending",
    playerStatus: null
  };

  try {
    const response = await fetch(url);
    responseJson = await response.json().catch(() => null);
    const resolvedUrl = resolvedFileUrlFromResponse(responseJson);
    const responseTime = new Date().toISOString();
    const resolverStatus = response.ok && responseJson?.ok !== false && resolvedUrl ? "resolved" : "failed";
    const failureReason = response.ok && responseJson?.ok !== false
      ? resolvedUrl ? null : "invalid_response_shape"
      : responseJson?.error || `Telegram file resolution failed with ${response.status}.`;
    const videoFields = meta.mediaRole === "video"
      ? {
          chosenVideoFieldName: meta.chosenVideoFieldName || meta.fieldName || meta.chosenFieldName || null,
          chosenFileIdOrUrl: meta.chosenFileIdOrUrl || fileId,
          endpointCalled: meta.endpointCalled || url,
          finalResolvedVideoUrl: resolvedUrl || null,
          failureReason
        }
      : {};

    addDeveloperConsoleEntry({
      source: "telegram media resolver",
      method: "GET",
      url,
      status: response.status,
      ok: response.ok,
      requestTime,
      responseTime,
      durationMs: Math.round(performance.now() - startedAt),
      requestPayload: {
        ...requestPayload,
        requestEndedAt: responseTime,
        responseStatus: response.status,
        resolvedUrlPreview: valuePreview(resolvedUrl),
        resolverStatus,
        fallbackReason: failureReason
      },
      responseJson: response.ok
        ? {
            ...responseJson,
            resolvedUrl,
            resolvedUrlPreview: valuePreview(resolvedUrl),
            responseStatus: response.status,
            requestStartedAt: requestTime,
            requestEndedAt: responseTime,
            resolverStatus,
            playerStatus: null,
            fallbackUsed: false,
            fallbackReason: failureReason,
            resolverState: resolverStatus === "resolved" ? "telegram_available" : "failed",
            resolverUrl: meta.resolverUrl || url,
            ...videoFields
          }
        : null,
      errorJson: response.ok
        ? null
        : {
            ...responseJson,
            responseStatus: response.status,
            requestStartedAt: requestTime,
            requestEndedAt: responseTime,
            resolvedUrlPreview: valuePreview(resolvedUrl),
            resolverStatus,
            playerStatus: null,
            fallbackUsed: false,
            fallbackReason: failureReason,
            resolverState: "failed",
            resolverUrl: meta.resolverUrl || url,
            exactError: failureReason,
            ...videoFields
          }
    });

    if (!response.ok || responseJson?.ok === false || !resolvedUrl) {
      throw new Error(failureReason || "invalid_response_shape");
    }

    return resolvedUrl || null;
  } catch (error) {
    if (!responseJson) {
      const responseTime = new Date().toISOString();
      const videoFields = meta.mediaRole === "video"
        ? {
            chosenVideoFieldName: meta.chosenVideoFieldName || meta.fieldName || meta.chosenFieldName || null,
            chosenFileIdOrUrl: meta.chosenFileIdOrUrl || fileId,
            endpointCalled: meta.endpointCalled || url,
            finalResolvedVideoUrl: null,
            failureReason: error.message
          }
        : {};

      addDeveloperConsoleEntry({
        source: "telegram media resolver",
        method: "GET",
        url,
        status: null,
        ok: false,
        requestTime,
        responseTime,
        durationMs: Math.round(performance.now() - startedAt),
        requestPayload: {
          ...requestPayload,
          requestEndedAt: responseTime,
          responseStatus: null,
          resolvedUrlPreview: null,
          resolverStatus: "failed",
          fallbackReason: error.message
        },
        errorJson: {
          message: error.message,
          exactError: error.message,
          requestStartedAt: requestTime,
          requestEndedAt: responseTime,
          responseStatus: null,
          resolvedUrlPreview: null,
          resolverStatus: "failed",
          playerStatus: null,
          fallbackUsed: false,
          fallbackReason: error.message,
          resolverState: "failed",
          resolverUrl: meta.resolverUrl || url,
          ...videoFields
        }
      });
    }

    throw error;
  }
}
