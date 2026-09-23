import type { AccountId } from "src/types/AccountId";
import type { LedgerFlare } from "src/types/LedgerFlare";
import type { SimulatedProviders } from "src/types/SimulatedProviders";
import { ACCOUNTS } from "src/utils/constants/accounts";

/**
 * What the application does on a sign-in or a sign-out. PostHog and Datadog
 * attach their own user to every event, so the application sets it there
 * too; Flare checks every report against it.
 */
export const switchAccount = (
  flare: LedgerFlare,
  providers: SimulatedProviders,
  accountId: AccountId | null,
) => {
  if (accountId === null) {
    providers.posthog.sdk.reset();
    providers.datadog.sdk.clearUser();
    flare.user(null);

    return;
  }

  const account = ACCOUNTS[accountId];

  providers.posthog.sdk.identify(account.id);
  providers.datadog.sdk.setUser({ id: account.id, email: account.email });
  flare.user({ id: account.id, email: account.email, name: account.name });
  flare.tag("plan", account.plan);
  flare.context("company", { name: account.company });
  flare.breadcrumb("signedIn", { company: account.company });
};
