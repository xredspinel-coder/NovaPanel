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

export async function resolveTelegramFileUrl(fileId) {
  if (!botApiBaseUrl || !fileId) {
    return null;
  }

  const url = `${botApiBaseUrl}/api/telegram-file/${encodeURIComponent(fileId)}`;
  const requestTime = new Date().toISOString();
  const startedAt = performance.now();
  let responseJson = null;

  try {
    const response = await fetch(url);
    responseJson = await response.json().catch(() => null);

    addDeveloperConsoleEntry({
      source: "telegram media resolver",
      method: "GET",
      url,
      status: response.status,
      ok: response.ok,
      requestTime,
      responseTime: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      responseJson: response.ok ? responseJson : null,
      errorJson: response.ok ? null : responseJson
    });

    if (!response.ok || responseJson?.ok === false) {
      throw new Error(responseJson?.error || `Telegram file resolution failed with ${response.status}.`);
    }

    return responseJson?.url || null;
  } catch (error) {
    if (!responseJson) {
      addDeveloperConsoleEntry({
        source: "telegram media resolver",
        method: "GET",
        url,
        status: null,
        ok: false,
        requestTime,
        responseTime: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
        errorJson: {
          message: error.message
        }
      });
    }

    throw error;
  }
}
