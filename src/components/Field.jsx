export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-text/48">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-panel/62 px-3 py-2 text-sm text-text outline-none transition duration-200 placeholder:text-text/32 focus:border-primary focus:bg-panel/88";

export const buttonClass =
  "rounded-md border border-primary/42 bg-primary/12 px-4 py-2 text-sm font-medium text-text transition duration-200 hover:border-primary hover:bg-primary/18";
