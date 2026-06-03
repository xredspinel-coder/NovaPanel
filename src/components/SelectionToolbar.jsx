import { CheckCircle2, Trash2, X } from "lucide-react";
import { buttonClass } from "./Field.jsx";

export function SelectionToolbar({
  selectedCount = 0,
  totalVisibleCount = 0,
  onSelectAll,
  onClear,
  onDeleteSelected,
  onCancel,
  isDeleting = false
}) {
  const safeSelectedCount = Number.isFinite(Number(selectedCount)) ? Number(selectedCount) : 0;
  const safeTotalVisibleCount = Number.isFinite(Number(totalVisibleCount)) ? Number(totalVisibleCount) : 0;
  const hasSelection = safeSelectedCount > 0;
  const hasVisibleItems = safeTotalVisibleCount > 0;
  const allVisibleSelected = hasVisibleItems && safeSelectedCount >= safeTotalVisibleCount;
  const quietButtonClass = `${buttonClass} border-line bg-panel/60 text-text/72 hover:border-primary hover:bg-panel`;
  const dangerButtonClass = `${buttonClass} border-red-300/30 bg-red-400/10 text-red-100 hover:border-red-300/50 hover:bg-red-400/20`;

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/10 p-3" aria-label="Selection toolbar">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex h-10 max-w-full items-center gap-2 rounded-md border border-primary/24 bg-panel/70 px-3 text-sm font-medium text-text">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{safeSelectedCount} selected</span>
          </div>
          <p className="mt-1 text-xs text-text/46">{safeTotalVisibleCount} visible after filters</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            className={quietButtonClass}
            type="button"
            onClick={onSelectAll}
            disabled={!hasVisibleItems || allVisibleSelected || isDeleting}
          >
            Select all
          </button>
          <button
            className={quietButtonClass}
            type="button"
            onClick={onClear}
            disabled={!hasSelection || isDeleting}
          >
            Clear
          </button>
          <button
            className={`${dangerButtonClass} col-span-2 sm:col-span-1`}
            type="button"
            onClick={onDeleteSelected}
            disabled={!hasSelection || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete selected"}
          </button>
          <button className={quietButtonClass} type="button" onClick={onCancel} disabled={isDeleting}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
