import Link from "next/link";
import { RaisedRow } from "@/components/raised-row";
import { Button } from "@/components/ui/button";

/**
 * "After a pass" on the project page (mockup 04, T22/T23). After a passing run of the current
 * check version the self-review is the screen's main action; before it, a quiet row says when
 * it opens.
 */
export function ReviewLink({ href, passed, revisions }: { href: string; passed: boolean; revisions: number }) {
  if (!passed) return <RaisedRow href={href} title="Self-review" line="Opens after your work passes the current check" />;
  return (
    <div className="space-y-1">
      <Button asChild size="lg" className="w-full">
        <Link href={href}>{revisions ? "Add to your self-review" : "Write self-review"}</Link>
      </Button>
      <p className="text-sm text-muted-foreground">
        {revisions ? `${revisions} revision${revisions === 1 ? "" : "s"} saved. ` : ""}Your own check: checklist, explanation, GPIS comparison.
      </p>
    </div>
  );
}
