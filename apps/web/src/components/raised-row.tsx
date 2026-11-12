import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** A raised, whole-row link with a title, one short line and a chevron. */
export function RaisedRow({ href, title, line, icon, children, className }: {
  href: string; title: string; line?: string; icon?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  return (
    <Link href={href} className={cn("flex min-h-16 min-w-0 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40", className)}>
      {icon ? <span aria-hidden="true" className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {line ? <span className="block truncate text-sm text-muted-foreground">{line}</span> : null}
        {children}
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
