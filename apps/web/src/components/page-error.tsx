/** The one error state for a page whose data could not be read. */
export function PageError({ message = "This page could not be loaded. Reload and try again." }: { message?: string }) {
  return <p role="alert" className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-4 shadow-sm">{message}</p>;
}
