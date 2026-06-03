import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Drawer({ open, eyebrow, title, description, onClose, children, footer, widthClass = "max-w-2xl" }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close drawer"
            className="absolute inset-0 bg-black/48 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`absolute right-0 top-0 flex h-full w-full ${widthClass} flex-col overflow-hidden border-l border-line bg-panel shadow-2xl sm:rounded-l-lg`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                {eyebrow ? <p className="text-xs uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
                <h2 className="mt-1 truncate text-xl font-semibold text-text">{title}</h2>
                {description ? <p className="mt-1 text-sm text-text/54">{description}</p> : null}
              </div>
              <button
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-text/62 transition duration-200 hover:border-primary hover:text-primary"
                type="button"
                onClick={onClose}
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer ? <footer className="border-t border-line px-5 py-4">{footer}</footer> : null}
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
