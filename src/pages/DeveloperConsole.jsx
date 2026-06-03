import { useEffect, useMemo, useState } from "react";
import JsonView from "@uiw/react-json-view";
import { vscodeTheme } from "@uiw/react-json-view/vscode";
import { ArrowLeft, CheckCircle2, Copy, Trash2, XCircle } from "lucide-react";
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

function JsonPanel({ title, value, defaultOpen = true }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [collapsed, setCollapsed] = useState(2);

  if (value === null || value === undefined) {
    return null;
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <details className="min-w-0 overflow-hidden rounded-md border border-line bg-ink/34" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="json-panel-summary flex min-w-0 cursor-pointer list-none flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-text/46">{title}</p>
          <p className="mt-1 text-xs text-text/38">Expandable syntax-highlighted payload</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-8 items-center gap-2 rounded border border-line px-2 font-mono text-xs text-text/70 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              copyJson();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            className="inline-flex h-8 items-center rounded border border-line px-2 font-mono text-xs text-text/70 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
              setCollapsed(false);
            }}
          >
            Expand all
          </button>
          <button
            className="inline-flex h-8 items-center rounded border border-line px-2 font-mono text-xs text-text/70 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
              setCollapsed(true);
            }}
          >
            Collapse all
          </button>
        </div>
      </summary>
      <div className="json-scroll max-h-[28rem] max-w-full overflow-auto border-t border-line p-3 font-mono text-xs">
        <JsonView
          key={String(collapsed)}
          value={value}
          style={{
            ...vscodeTheme,
            backgroundColor: "transparent",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          }}
          collapsed={collapsed}
          displayDataTypes={false}
          enableClipboard
          shortenTextAfterLength={90}
        />
      </div>
    </details>
  );
}

function StatusBadge({ ok }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${ok ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {ok ? "success" : "error"}
    </span>
  );
}

function RequestListItem({ log, active, onSelect }) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      className={`block w-full border-b border-l-2 px-3 py-3 text-left transition duration-150 hover:bg-primary/8 ${
        active ? "border-b-line border-l-primary bg-primary/12 shadow-[inset_0_0_0_1px_rgb(var(--primary-rgb)/0.16)]" : "border-b-line border-l-transparent bg-transparent"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-ink ${log.ok ? "bg-emerald-300" : "bg-red-300"}`} />
          <span className="rounded border border-line bg-ink/28 px-1.5 py-0.5 font-mono text-[0.68rem] text-text/62">{log.method}</span>
          <span className={`truncate text-xs ${active ? "font-medium text-primary" : "text-primary/82"}`}>{log.source}</span>
        </div>
        <span className="shrink-0 font-mono text-xs text-text/42">{log.durationMs}ms</span>
      </div>
      <p className="mt-2 truncate font-mono text-sm text-text/78">{log.url}</p>
      <p className="mt-1 truncate text-xs text-text/42">{formatTime(log.requestTime)}</p>
    </button>
  );
}

function DetailCell({ label, value }) {
  return (
    <div className="rounded-md border border-line bg-ink/24 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.14em] text-text/38">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-text/70">{value ?? "-"}</p>
    </div>
  );
}

function RequestDetails({ log, onBack }) {
  const [copied, setCopied] = useState(false);

  if (!log) {
    return <EmptyState title="Select a request" detail="Choose an entry from the request list to inspect its payloads." />;
  }

  async function copyLog() {
    await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const hasDeleteMetadata = log.sourceCollection || log.documentId || log.deletePath || log.firebaseErrorCode;
  const hasMediaMetadata = log.resolvedVideoSource || log.resolvedImageSource;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel/92">
      <header className="border-b border-line px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge ok={Boolean(log.ok)} />
              <span className="rounded-md border border-line bg-ink/28 px-2 py-1 font-mono text-xs text-text/70">{log.method}</span>
              <span className="rounded-md border border-primary/24 bg-primary/10 px-2 py-1 text-xs text-primary">{log.source}</span>
              {log.status !== null ? <span className="font-mono text-xs text-text/46">{log.status}</span> : null}
            </div>
            <h2 className="mt-3 break-all font-mono text-sm text-text">{log.url}</h2>
            {log.message ? <p className="mt-2 rounded-md border border-line bg-ink/24 px-3 py-2 text-sm text-text/70">{log.message}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {onBack ? (
              <button className={`${buttonClass} inline-flex items-center gap-2 xl:hidden`} type="button" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Back to requests
              </button>
            ) : null}
            <button className={`${buttonClass} inline-flex items-center gap-2`} type="button" onClick={copyLog}>
              <Copy className="h-4 w-4" />
              {copied ? "Copied" : "Copy request"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailCell label="Request time" value={formatTime(log.requestTime)} />
          <DetailCell label="Response time" value={formatTime(log.responseTime)} />
          <DetailCell label="Duration" value={`${log.durationMs}ms`} />
          <DetailCell label="Source" value={log.source} />
        </section>

        {hasDeleteMetadata ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailCell label="Source collection" value={log.sourceCollection} />
            <DetailCell label="Document ID" value={log.documentId} />
            <DetailCell label="Delete path" value={log.deletePath} />
            <DetailCell label="Firebase error code" value={log.firebaseErrorCode} />
          </section>
        ) : null}

        {hasMediaMetadata ? (
          <section className="grid gap-3 md:grid-cols-2">
            <DetailCell label="Resolved video source" value={log.resolvedVideoSource} />
            <DetailCell label="Resolved image source" value={log.resolvedImageSource} />
          </section>
        ) : null}

        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          <JsonPanel title="Request Payload" value={log.requestPayload} />
          <JsonPanel title="Response JSON" value={log.responseJson} />
          <JsonPanel title="Error JSON" value={log.errorJson} defaultOpen={Boolean(log.errorJson)} />
          <JsonPanel title="Raw Entry" value={log} defaultOpen={false} />
        </section>
      </div>
    </section>
  );
}

export function DeveloperConsole() {
  const logs = useDeveloperConsoleLogs();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [source, setSource] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [mobileView, setMobileView] = useState("requests");

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

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      setMobileView("requests");
      return;
    }

    if (!filtered.some((log) => log.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedLog = filtered.find((log) => log.id === selectedId) || null;
  const selectLog = (id) => {
    setSelectedId(id);
    setMobileView("details");
  };

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
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel p-1 xl:hidden">
            <button
              className={`rounded-md px-3 py-2 text-sm transition ${mobileView === "requests" ? "bg-primary/14 text-primary" : "text-text/58 hover:text-text"}`}
              type="button"
              onClick={() => setMobileView("requests")}
            >
              Requests
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm transition ${mobileView === "details" ? "bg-primary/14 text-primary" : "text-text/58 hover:text-text"}`}
              type="button"
              onClick={() => setMobileView("details")}
            >
              Details
            </button>
          </div>
          <section className="grid min-h-[640px] gap-4 xl:grid-cols-[380px_1fr]">
            <aside className={`${mobileView === "details" ? "hidden xl:block" : "block"} overflow-hidden rounded-lg border border-line bg-panel/92`}>
              <div className="border-b border-line px-3 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-text/42">Request list</p>
                <p className="mt-1 text-sm text-text/62">{filtered.length} entries</p>
              </div>
              <div className="max-h-[640px] overflow-y-auto">
                {filtered.map((log) => (
                  <RequestListItem key={log.id} log={log} active={selectedId === log.id} onSelect={() => selectLog(log.id)} />
                ))}
              </div>
            </aside>
            <div className={`${mobileView === "requests" ? "hidden xl:block" : "block"} min-h-[520px]`}>
              <RequestDetails log={selectedLog} onBack={() => setMobileView("requests")} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
