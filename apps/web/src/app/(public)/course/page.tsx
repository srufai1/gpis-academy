import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Course map" };

/** Public, read-only course map. Placeholder until the map screen (T07) exists. */
export default function PublicCourseMapPage() {
  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
      <h1 className="text-xl font-semibold">Course map</h1>
      <p className="text-muted-foreground">The full map opens here soon.</p>
      <Button asChild variant="outline">
        <Link href="/">Back</Link>
      </Button>
    </main>
  );
}
