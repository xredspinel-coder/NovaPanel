const storageKey = "novapanel-developer-console-logs";
const maxLogs = 50;
const listeners = new Set();

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function redactSensitiveString(value) {
  return String(value).replace(/https:\/\/api\.telegram\.org\/file\/bot[^/]+/gi, "https://api.telegram.org/file/bot<redacted>");
}

function redactSensitiveValue(value) {
  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactSensitiveValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactSensitiveValue(item)])
    );
  }

  return value;
}

function normalizeJson(value) {
  if (value === undefined) {
    return null;
  }

  try {
    return redactSensitiveValue(JSON.parse(JSON.stringify(value)));
  } catch {
    return redactSensitiveString(value);
  }
}

function readStoredLogs() {
  if (typeof window === "undefined") {
    return [];
  }

  return safeParse(window.localStorage.getItem(storageKey) || "[]", []);
}

let logs = readStoredLogs();

function persistLogs() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(logs));
    } catch (error) {
      console.warn("Could not persist Developer Console logs.", error);
    }
  }
}

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("Developer Console listener failed.", error);
    }
  });
}

export function getDeveloperConsoleLogs() {
  return logs;
}

export function subscribeDeveloperConsole(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearDeveloperConsoleLogs() {
  logs = [];
  persistLogs();
  emitChange();
}

export function addDeveloperConsoleEntry(entry) {
  try {
    const safeEntry = entry && typeof entry === "object" ? entry : {};
    const requestTime = safeEntry.requestTime || new Date().toISOString();
    const responseTime = safeEntry.responseTime || new Date().toISOString();
    const requestPayload = normalizeJson(safeEntry.requestPayload);
    const responseJson = normalizeJson(safeEntry.responseJson);
    const errorJson = normalizeJson(safeEntry.errorJson);
    const sourceCollection = safeEntry.sourceCollection ?? requestPayload?.sourceCollection ?? requestPayload?.collectionName ?? null;
    const documentId = safeEntry.documentId ?? requestPayload?.documentId ?? requestPayload?.id ?? null;
    const deletePath = safeEntry.deletePath ?? requestPayload?.deletePath ?? (sourceCollection && documentId ? `${sourceCollection}/${documentId}` : null);
    const firebaseErrorCode = safeEntry.firebaseErrorCode ?? errorJson?.firebaseErrorCode ?? errorJson?.code ?? null;
    const resolvedVideoSource = safeEntry.resolvedVideoSource ?? responseJson?.resolvedVideoSource ?? null;
    const resolvedImageSource = safeEntry.resolvedImageSource ?? responseJson?.resolvedImageSource ?? null;
    const normalized = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      source: safeEntry.source || "dashboard action",
      method: safeEntry.method || "GET",
      url: redactSensitiveString(safeEntry.url || "dashboard://unknown"),
      status: safeEntry.status ?? null,
      ok: Boolean(safeEntry.ok),
      sourceCollection,
      documentId,
      deletePath,
      firebaseErrorCode,
      resolvedVideoSource,
      resolvedImageSource,
      requestTime,
      responseTime,
      durationMs: safeEntry.durationMs ?? Math.max(0, new Date(responseTime).getTime() - new Date(requestTime).getTime()),
      requestPayload,
      responseJson,
      errorJson,
      message: safeEntry.message || null
    };

    logs = [normalized, ...logs].slice(0, maxLogs);
    persistLogs();
    emitChange();
    return normalized;
  } catch (error) {
    console.warn("Could not add Developer Console entry.", error);
    return null;
  }
}
