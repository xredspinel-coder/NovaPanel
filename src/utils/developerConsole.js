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
    window.localStorage.setItem(storageKey, JSON.stringify(logs));
  }
}

function emitChange() {
  listeners.forEach((listener) => listener());
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
  const requestTime = entry.requestTime || new Date().toISOString();
  const responseTime = entry.responseTime || new Date().toISOString();
  const requestPayload = normalizeJson(entry.requestPayload);
  const responseJson = normalizeJson(entry.responseJson);
  const errorJson = normalizeJson(entry.errorJson);
  const sourceCollection = entry.sourceCollection ?? requestPayload?.sourceCollection ?? requestPayload?.collectionName ?? null;
  const documentId = entry.documentId ?? requestPayload?.documentId ?? requestPayload?.id ?? null;
  const deletePath = entry.deletePath ?? requestPayload?.deletePath ?? (sourceCollection && documentId ? `${sourceCollection}/${documentId}` : null);
  const firebaseErrorCode = entry.firebaseErrorCode ?? errorJson?.firebaseErrorCode ?? errorJson?.code ?? null;
  const normalized = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    source: entry.source || "dashboard action",
    method: entry.method || "GET",
    url: redactSensitiveString(entry.url || "dashboard://unknown"),
    status: entry.status ?? null,
    ok: Boolean(entry.ok),
    sourceCollection,
    documentId,
    deletePath,
    firebaseErrorCode,
    requestTime,
    responseTime,
    durationMs: entry.durationMs ?? Math.max(0, new Date(responseTime).getTime() - new Date(requestTime).getTime()),
    requestPayload,
    responseJson,
    errorJson,
    message: entry.message || null
  };

  logs = [normalized, ...logs].slice(0, maxLogs);
  persistLogs();
  emitChange();
  return normalized;
}
