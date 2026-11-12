import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <h1 className="text-xl font-semibold">Map</h1>
      <p className="text-muted-foreground">Coming soon.</p>
    </div>
  );
}
