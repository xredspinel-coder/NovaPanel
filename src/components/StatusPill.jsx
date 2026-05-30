const styles = {
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  error: "border-red-400/20 bg-red-400/10 text-red-200",
  low_similarity: "border-amber-400/20 bg-amber-400/10 text-amber-200"
};

export function StatusPill({ status }) {
  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${styles[status] || "border-white/10 bg-white/5 text-white/60"}`}>
      {status || "unknown"}
    </span>
  );
}
