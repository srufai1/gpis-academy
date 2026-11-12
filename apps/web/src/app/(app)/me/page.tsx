import type { Metadata } from "next";

export const metadata: Metadata = { title: "Me" };

export default function MePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <h1 className="text-xl font-semibold">Me</h1>
      <p className="text-muted-foreground">Coming soon.</p>
    </div>
  );
}
