export function EmptyState({ title = "No data", detail = "Nothing has been written to Firestore yet." }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-8 text-center">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm text-white/45">{detail}</p>
    </div>
  );
}
