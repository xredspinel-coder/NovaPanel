import { X } from "lucide-react";
import { buttonClass } from "./Field.jsx";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  error = "",
  onCancel,
  onConfirm
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <section className="w-full max-w-md rounded-lg border border-line bg-panel shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-text">{title}</h2>
            <p className="mt-1 text-sm text-text/58">{message}</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-md border border-line text-text/62 transition hover:text-primary" type="button" onClick={onCancel} aria-label="Close confirmation">
            <X className="h-4 w-4" />
          </button>
        </header>

        {error ? (
          <p className="border-b border-line px-5 py-3 text-sm text-red-200">{error}</p>
        ) : null}

        <div className="flex justify-end gap-3 px-5 py-4">
          <button className={buttonClass} type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="rounded-md border border-red-400/50 bg-red-500/14 px-4 py-2 text-sm font-medium text-red-100 transition hover:border-red-300 hover:bg-red-500/22 disabled:cursor-wait disabled:opacity-60"
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
