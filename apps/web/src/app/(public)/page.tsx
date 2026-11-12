import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE } from "@/config/site";

/** Landing page (mockup 01-landing.md). Main action: Start learning. */
export default function LandingPage() {
  const t = SITE.landing;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
        <span className="font-semibold">{SITE.name}</span>
        <Button asChild variant="ghost">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </header>
      <main className="flex flex-1 flex-col divide-y">
        <section className="space-y-6 px-4 py-10">
          <h1 className="text-2xl font-semibold leading-tight text-balance">{t.headline}</h1>
          <Button asChild size="lg" className="w-full">
            <Link href="/sign-up">{t.start}</Link>
          </Button>
        </section>
        <section className="px-4 py-6">
          <ol className="space-y-3">
            {t.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="space-y-3 px-4 py-6">
          <p className="font-medium">{t.length}</p>
          <p className="text-muted-foreground">{t.then}</p>
          <Button asChild variant="outline">
            <Link href="/course">{t.courseMap}</Link>
          </Button>
        </section>
        <footer className="px-4 py-6 text-sm text-muted-foreground">{t.privacy}</footer>
      </main>
    </div>
  );
}
