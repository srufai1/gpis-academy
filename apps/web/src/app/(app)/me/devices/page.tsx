import type { Metadata } from "next";
import { PageError } from "@/components/page-error";
import { Button } from "@/components/ui/button";
import { CopyCommand } from "@/components/copy-command";
import { requireLearner } from "@/lib/auth/learner";
import { revokeDevice } from "./actions";

export const metadata: Metadata = { title: "Devices" };

type DeviceRow = { id: string; label: string; created_at: string; revoked_at: string | null };

/** The computers where the checker is signed in (T18). Revoke stops their results. */
export default async function DevicesPage() {
  const { supabase } = await requireLearner();
  const { data, error } = await supabase.from("devices").select("id, label, created_at, revoked_at").order("created_at", { ascending: false }).limit(100);
  if (error) return <PageError />;
  const devices = (data ?? []) as DeviceRow[];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Devices</h1>
      <p className="text-muted-foreground">
        A device is a computer where you ran the login command. Revoking a device stops its results.
        To sign the checker out on that computer, run <code>npx academy logout</code> there.
      </p>
      {devices.length === 0 ? (
        <div className="space-y-2">
          <p>No devices yet. In your project folder, run:</p>
          <CopyCommand command="npx academy login" />
        </div>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <li key={d.id} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.label || "Unnamed device"}</span>
                <span className="block text-sm text-muted-foreground">
                  Added {d.created_at.slice(0, 10)}
                  {d.revoked_at ? ` · Revoked ${d.revoked_at.slice(0, 10)}` : ""}
                </span>
              </span>
              {d.revoked_at ? null : (
                <form action={revokeDevice}>
                  <input type="hidden" name="device_id" value={d.id} />
                  <Button type="submit" variant="outline" className="min-h-11">Revoke</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
