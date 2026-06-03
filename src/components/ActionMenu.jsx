import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export function ActionMenu({ items, label = "Actions", align = "right" }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel/62 px-3 text-sm text-text/72 transition duration-200 hover:border-primary hover:text-primary"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open ? (
        <div
          className={`absolute top-full z-40 mt-2 w-52 overflow-hidden rounded-md border border-line bg-panel/98 p-1 shadow-[0_18px_54px_rgb(0_0_0/0.28)] backdrop-blur ${
            align === "left" ? "left-0" : "right-0"
          }`}
          role="menu"
        >
          {safeItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm transition duration-150 disabled:cursor-not-allowed disabled:opacity-42 ${
                item.danger ? "text-red-200 hover:bg-red-400/10" : "text-text/76 hover:bg-primary/10 hover:text-primary"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect?.();
              }}
            >
              <span>{item.label}</span>
              {item.meta ? <span className="text-xs text-text/40">{item.meta}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
