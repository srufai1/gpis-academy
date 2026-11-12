"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { markRead, type ReadState } from "./actions";

export function ReadButton({ unitId, read }: { unitId: string; read: boolean }) {
  const [state, action, pending] = useActionState<ReadState>(() => markRead(unitId), {});
  if (read || state.done) return <p className="text-sm text-muted-foreground">You have read this lesson.</p>;
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Saving…" : "I have read this"}
      </Button>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
