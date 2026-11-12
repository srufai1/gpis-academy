/** Shown while a signed-in page loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-3xl space-y-3">
      <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
    </div>
  );
}
