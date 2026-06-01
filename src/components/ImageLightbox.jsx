import { useEffect } from "react";
import { X } from "lucide-react";

export function ImageLightbox({ src, alt = "Image preview", onClose }) {
  useEffect(() => {
    if (!src) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [src, onClose]);

  if (!src) {
    return null;
  }

  return (
    <div
      className="image-lightbox-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-md border border-white/18 bg-black/45 text-white/82 transition hover:border-primary/50 hover:text-primary"
        onClick={onClose}
        aria-label="Close image preview"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        className="image-lightbox-image max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl ring-1 ring-white/12"
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
