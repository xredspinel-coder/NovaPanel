import { useMemo, useState } from "react";
import JsonView from "@uiw/react-json-view";
import { vscodeTheme } from "@uiw/react-json-view/vscode";
import { CheckCircle2, Copy, Trash2, XCircle } from "lucide-react";
import { buttonClass, inputClass } from "../components/Field.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { useDeveloperConsoleLogs } from "../hooks/useDeveloperConsoleLogs.js";
import { clearDeveloperConsoleLogs } from "../utils/developerConsole.js";

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function JsonPanel({ title, value }) {
  const [copied, setCopied] = useState(false);

  if (value === null || value === undefined) {
    return null;
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="rounded-md border border-line bg-ink/34">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-text/46">{title}</p>
        <button className="inline-flex items-center gap-2 rounded border border-line px-2 py-1 font-mono text-xs text-text/70 transition hover:border-primary hover:text-primary" type="button" onClick={copyJson}>
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <div className="max-h-96 overflow-auto p-3 font-mono text-xs">
        <JsonView
          value={value}
          style={{
            ...vscodeTheme,
            backgroundColor: "transparent",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          }}
          collapsed={2}
          displayDataTypes={false}
          enableClipboard
          shortenTextAfterLength={80}
        />
      </div>
    </section>
  );
}

function LogCard({ log }) {
  const ok = Boolean(log.ok);
  const hasDeleteMetadata = log.sourceCollection || log.documentId || log.deletePath || log.firebaseErrorCode;
  const hasMediaMetadata = log.resolvedVideoSource || log.resolvedImageSource;

  return (
    <details className="group rounded-lg border border-line bg-panel/92 shadow-[0_18px_70px_rgb(0_0_0/0.10)]">
      <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${ok ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`}>
              {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {ok ? "success" : "error"}
            </span>
            <span className="rounded-md border border-line bg-ink/28 px-2 py-1 font-mono text-xs text-text/70">{log.method}</span>
            <span className="rounded-md border border-primary/24 bg-primary/10 px-2 py-1 text-xs text-primary">{log.source}</span>
            {log.status !== null ? <span className="font-mono text-xs text-text/46">{log.status}</span> : null}
          </div>
          <p className="mt-2 truncate font-mono text-sm text-text">{log.url}</p>
          {log.deletePath ? <p className="mt-1 truncate font-mono text-xs text-text/46">delete path: {log.deletePath}</p> : null}
        </div>
        <div className="text-right font-mono text-xs text-text/46">
          <p>{log.durationMs}ms</p>
          <p>{formatTime(log.requestTime)}</p>
        </div>
      </summary>

      <div className="space-y-4 border-t border-line px-4 py-4">
        <div className="grid gap-3 font-mono text-xs text-text/64 md:grid-cols-4">
          <div>
            <p className="text-text/38">Request time</p>
            <p>{formatTime(log.requestTime)}</p>
          </div>
          <div>
            <p className="text-text/38">Response time</p>
            <p>{formatTime(log.responseTime)}</p>
          </div>
          <div>
            <p className="text-text/38">Duration</p>
            <p>{log.durationMs}ms</p>
          </div>
          <div>
            <p className="text-text/38">Source</p>
            <p>{log.source}</p>
          </div>
        </div>

        {hasDeleteMetadata ? (
          <div className="grid gap-3 rounded-md border border-line bg-ink/24 px-3 py-3 font-mono text-xs text-text/64 md:grid-cols-4">
            <div>
              <p className="text-text/38">Source collection</p>
              <p>{log.sourceCollection || "-"}</p>
            </div>
            <div>
              <p className="text-text/38">Document ID</p>
              <p className="break-all">{log.documentId || "-"}</p>
            </div>
            <div>
              <p className="text-text/38">Delete path</p>
              <p className="break-all">{log.deletePath || "-"}</p>
            </div>
            <div>
              <p className="text-text/38">Firebase error code</p>
              <p>{log.firebaseErrorCode || "-"}</p>
            </div>
          </div>
        ) : null}

        {hasMediaMetadata ? (
          <div className="grid gap-3 rounded-md border border-line bg-ink/24 px-3 py-3 font-mono text-xs text-text/64 md:grid-cols-2">
            <div>
              <p className="text-text/38">Resolved video source</p>
              <p>{log.resolvedVideoSource || "-"}</p>
            </div>
            <div>
              <p className="text-text/38">Resolved image source</p>
              <p>{log.resolvedImageSource || "-"}</p>
            </div>
          </div>
        ) : null}

        {log.message ? <p className="rounded-md border border-line bg-ink/28 px-3 py-2 text-sm text-text/70">{log.message}</p> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <JsonPanel title="Request Payload" value={log.requestPayload} />
          <JsonPanel title="Response JSON" value={log.responseJson} />
          <JsonPanel title="Error JSON" value={log.errorJson} />
        </div>
      </div>
    </details>
  );
}

export function DeveloperConsole() {
  const logs = useDeveloperConsoleLogs();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [source, setSource] = useState("all");

  const methods = useMemo(() => unique(logs.map((log) => log.method)), [logs]);
  const sources = useMemo(() => unique(logs.map((log) => log.source)), [logs]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesStatus = status === "all" || (status === "success" ? log.ok : !log.ok);
      const matchesMethod = method === "all" || log.method === method;
      const matchesSource = source === "all" || log.source === source;
      const matchesSearch =
        !needle ||
        [
          log.url,
          log.source,
          log.method,
          log.status,
          log.message,
          log.sourceCollection,
          log.documentId,
          log.deletePath,
          log.firebaseErrorCode,
          log.resolvedVideoSource,
          log.resolvedImageSource
        ]
          .filter((value) => value !== null && value !== undefined)
          .some((value) => String(value).toLowerCase().includes(needle));

      return matchesStatus && matchesMethod && matchesSource && matchesSearch;
    });
  }, [logs, method, search, source, status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Developer Console</h1>
          <p className="text-sm text-text/54">Local browser-session logs for dashboard API, download, resolver, and Firestore actions.</p>
        </div>
        <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={clearDeveloperConsoleLogs}>
          <Trash2 className="h-4 w-4" />
          Clear console
        </button>
      </div>

      <section className="grid gap-3 rounded-lg border border-line bg-panel p-4 md:grid-cols-2 xl:grid-cols-5">
        <input className={`${inputClass} xl:col-span-2`} placeholder="Search console" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
        <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="all">All methods</option>
          {methods.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={inputClass} value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">All sources</option>
          {sources.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </section>

      {filtered.length === 0 ? (
        <EmptyState title={logs.length === 0 ? "Console is empty" : "No console entries found"} detail="Resolver, delete, and download actions will appear here while you use NovaPanel." />
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => <LogCard key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}
