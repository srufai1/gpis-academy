/** Test only: the password forms with a stand-in action, so they can be drawn without a server. */
import { ForgotForm, ResetForm } from "../../apps/web/src/app/(auth)/password-forms";

const action = async () => ({});
export const ForgotFixture = () => <ForgotForm action={action} />;
export const ResetFixture = () => <ResetForm action={action} />;
