import { addDeveloperConsoleEntry } from "./developerConsole.js";

export async function downloadFile(url, filename) {
  const requestTime = new Date().toISOString();
  const startedAt = performance.now();

  try {
    const response = await fetch(url);

    addDeveloperConsoleEntry({
      source: "download action",
      method: "GET",
      url,
      status: response.status,
      ok: response.ok,
      requestTime,
      responseTime: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      responseJson: {
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length")
      },
      errorJson: response.ok ? null : {
        message: `Download request failed with ${response.status}.`
      }
    });

    if (!response.ok) {
      throw new Error(`Download request failed with ${response.status}.`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);

    return {
      downloaded: true,
      fallbackOpened: false
    };
  } catch (error) {
    addDeveloperConsoleEntry({
      source: "download action",
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

    window.open(url, "_blank", "noopener,noreferrer");
    return {
      downloaded: false,
      fallbackOpened: true,
      message: "Direct download blocked by source, opened video instead."
    };
  }
}
