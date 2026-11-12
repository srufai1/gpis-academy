"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Map as MapIcon, User } from "lucide-react";
import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

const ICONS = { "/map": MapIcon, "/progress": BarChart3, "/me": User } as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Signed-in shell: a top bar, a bottom bar on phones (Map · Progress · Me) and a sidebar
 * from md: up. One set of links serves both.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links = SITE.nav.map((item) => ({ ...item, Icon: ICONS[item.href], active: isActive(pathname, item.href) }));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r md:block">
        <div className="px-4 py-4 font-semibold">{SITE.name}</div>
        <nav aria-label="Main" className="space-y-1 px-2">
          {links.map(({ href, label, Icon, active }) => (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm", active ? "bg-muted font-medium" : "hover:bg-muted")}>
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-12 items-center border-b px-4 md:hidden">
          <span className="font-semibold">{SITE.name}</span>
        </header>
        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 md:pb-8">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {links.map(({ href, label, Icon, active }) => (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-xs", active ? "font-medium text-primary" : "text-muted-foreground")}>
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
