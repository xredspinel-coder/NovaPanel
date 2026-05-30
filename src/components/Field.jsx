export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-primary";

export const buttonClass =
  "rounded-md border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-medium text-white transition hover:border-primary";
