import type { Metadata } from "next";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <h1 className="text-xl font-semibold">Progress</h1>
      <p className="text-muted-foreground">Coming soon.</p>
    </div>
  );
}
