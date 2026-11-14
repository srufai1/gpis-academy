/** Test only: the self-review form with a stand-in save action, so it can be drawn without a server. */
import { ReviewForm } from "../../apps/web/src/app/(app)/project/[id]/review/review-form";

type Props = Omit<Parameters<typeof ReviewForm>[0], "action">;

export function ReviewFormFixture(props: Props) {
  return <ReviewForm {...props} action={async () => ({})} />;
}
