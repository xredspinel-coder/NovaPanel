export function EmptyState({ title = "No data", detail = "Nothing has been written to Firestore yet." }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel/38 p-8 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="mt-2 text-sm text-text/52">{detail}</p>
    </div>
  );
}
