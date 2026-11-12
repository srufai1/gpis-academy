import Link from "next/link";
import { SITE } from "@/config/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-4">
      <Link href="/" className="flex min-h-12 items-center font-semibold">{SITE.name}</Link>
      <main className="flex-1 py-8">{children}</main>
    </div>
  );
}
