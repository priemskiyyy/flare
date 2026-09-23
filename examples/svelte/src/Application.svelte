<script lang="ts">
  import type { Receipt } from "@priemskiyyy/flare";
  import { FlareProvider } from "@priemskiyyy/flare-svelte";
  import { INITIAL_ACCOUNT } from "examples/shared/ledger/constants/accounts";
  import type { AccountId } from "examples/shared/ledger/types/AccountId";
  import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
  import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
  import type { SimulatedProviders } from "examples/shared/ledger/types/SimulatedProviders";
  import { switchAccount } from "examples/shared/ledger/utils/switchAccount";
  import Devtools from "src/components/Devtools/Devtools.svelte";
  import Header from "src/components/Header/Header.svelte";
  import LedgerApp from "src/components/Ledger/LedgerApp.svelte";
  import LatestReportPanel from "src/components/Report/LatestReportPanel.svelte";

  type Props = { providers: SimulatedProviders; runtime: LedgerRuntime };

  let { providers, runtime }: Props = $props();

  let account = $state<AccountId | null>(INITIAL_ACCOUNT);

  // A page that is being hidden may never come back: send what is queued.
  const handleVisibilityChange = () => {
    if (document.visibilityState !== "hidden") {
      return;
    }

    runtime.flare.flush({ timeout: 1_000 }).catch(() => {});
  };

  const handleAccountSelect = (next: AccountId | null) => {
    account = next;
    switchAccount(runtime.flare, providers, next);
  };

  const handleReceipt = (
    receipt: Receipt<LedgerDestination>,
    action: string,
  ) => {
    runtime.track(receipt, action, account);
  };
</script>

<svelte:document onvisibilitychange={handleVisibilityChange} />

<FlareProvider flare={runtime.flare}>
  <Header />
  <main class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
    <div class="flex max-w-3xl flex-col gap-2">
      <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">
        Ledger on Svelte
      </h2>
      <p class="text-base text-stone-600 dark:text-stone-400">
        The invoicing app from the React example, written with Svelte runes. Pay
        an invoice or break the preview, and the latest report shows where it
        went. The Flare button in the corner opens the devtools over the same
        runtime.
      </p>
    </div>
    <div class="grid items-start gap-4 lg:grid-cols-2">
      <LedgerApp
        {account}
        onAccountSelect={handleAccountSelect}
        onReceipt={handleReceipt}
      />
      <LatestReportPanel {runtime} />
    </div>
  </main>
  <Devtools />
</FlareProvider>
