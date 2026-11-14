"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { REVIEW_TEXT_MAX } from "@/lib/reviews/validate";
import type { ReviewFormState } from "./actions";

type Props = {
  action: (state: ReviewFormState, form: FormData) => Promise<ReviewFormState>;
  items: string[];
  /** The newest revision, so a save starts from it. Saving always makes a new revision. */
  defaults: { checked: boolean[]; explanation: string; comparison: string };
  compareHtml: string;
};

const field = "block w-full rounded-lg border bg-card px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/40";

/** The self-review form (T22). */
export function ReviewForm({ action, items, defaults, compareHtml }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-6">
      {items.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold">Review checklist</legend>
          <p className="text-sm text-muted-foreground">Tick only what is true.</p>
          {items.map((text, i) => (
            <label key={i} className="flex min-h-11 items-start gap-3 rounded-lg py-2">
              <input type="checkbox" name={`item-${i}`} defaultChecked={defaults.checked[i] ?? false} className="mt-0.5 size-5 shrink-0 accent-primary" />
              <span className="min-w-0 break-words">{text}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <label className="block space-y-2">
        <span className="font-semibold">Explain your solution</span>
        <span className="block text-sm text-muted-foreground">How does it work, and why did you do it this way? In your own words.</span>
        <textarea name="explanation" required maxLength={REVIEW_TEXT_MAX} rows={7} defaultValue={defaults.explanation} className={field} />
      </label>

      <label className="block space-y-2">
        <span className="font-semibold">Compare with GPIS</span>
        <span className="md block text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: compareHtml }} />
        <textarea name="gpis_comparison" required maxLength={REVIEW_TEXT_MAX} rows={6} defaultValue={defaults.comparison} className={field} />
      </label>

      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.saved ? <p role="status" className="text-sm">Saved as revision {state.saved}. Earlier revisions stay below.</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Saving…" : "Save self-review"}
      </Button>
    </form>
  );
}
