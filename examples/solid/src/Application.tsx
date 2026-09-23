import type { Receipt } from "@priemskiyyy/flare";
import { FlareDevtools } from "@priemskiyyy/flare-devtools/solid";
import { FlareProvider } from "@priemskiyyy/flare-solid";
import { createSignal, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import { INITIAL_ACCOUNT } from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
import type { SimulatedProviders } from "examples/shared/ledger/types/SimulatedProviders";
import { switchAccount } from "examples/shared/ledger/utils/switchAccount";
import { Header } from "src/components/Header/Header";
import { LedgerApp } from "src/components/Ledger/LedgerApp";
import { LatestReportPanel } from "src/components/Report/LatestReportPanel";

type ApplicationProps = {
  runtime: LedgerRuntime;
  providers: SimulatedProviders;
};

export const Application: Component<ApplicationProps> = (props) => {
  const [account, setAccount] = createSignal<AccountId | null>(INITIAL_ACCOUNT);

  // A page that is being hidden may never come back: send what is queued.
  const handleVisibilityChange = () => {
    if (document.visibilityState !== "hidden") {
      return;
    }

    props.runtime.flare.flush({ timeout: 1_000 }).catch(() => {});
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  onCleanup(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  const handleAccountSelect = (next: AccountId | null) => {
    setAccount(next);
    switchAccount(props.runtime.flare, props.providers, next);
  };

  const handleReceipt = (
    receipt: Receipt<LedgerDestination>,
    action: string,
  ) => {
    props.runtime.track(receipt, action, account());
  };

  return (
    <FlareProvider flare={props.runtime.flare}>
      <Header />
      <main class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div class="flex max-w-3xl flex-col gap-2">
          <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ledger on Solid
          </h2>
          <p class="text-base leading-relaxed text-stone-600 dark:text-stone-400">
            The invoicing app from the React example, written with Solid
            accessors. Every button fails on purpose, and its report lands under
            Latest report with what each destination answered. The Flare button
            in the corner opens the devtools over the same runtime.
          </p>
        </div>
        <div class="grid items-start gap-4 lg:grid-cols-2">
          <LedgerApp
            account={account()}
            onAccountSelect={handleAccountSelect}
            onReceipt={handleReceipt}
          />
          <LatestReportPanel runtime={props.runtime} />
        </div>
      </main>
      <FlareDevtools />
    </FlareProvider>
  );
};
