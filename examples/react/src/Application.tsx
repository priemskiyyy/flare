import type { Receipt } from "@priemskiyyy/flare";
import { FlareDevtools } from "@priemskiyyy/flare-devtools/react";
import { FlareProvider } from "@priemskiyyy/flare-react";
import type React from "react";
import { useEffect, useState } from "react";

import { DestinationsPanel } from "src/components/Destinations/DestinationsPanel";
import { Footer } from "src/components/Footer/Footer";
import { Header } from "src/components/Header/Header";
import { Hero } from "src/components/Hero/Hero";
import { LabPanel } from "src/components/Lab/LabPanel";
import { NetworkPanel } from "src/components/Lab/NetworkPanel";
import { LedgerApp } from "src/components/Ledger/LedgerApp";
import { ReceiptsPanel } from "src/components/Receipts/ReceiptsPanel";
import { LatestReportPanel } from "src/components/Report/LatestReportPanel";
import { Section } from "src/components/Section/Section";
import { TimelinePanel } from "src/components/Timeline/TimelinePanel";
import { createLedgerRuntime } from "src/reporting/createLedgerRuntime";
import type { AccountId } from "src/types/AccountId";
import type { LedgerDestination } from "src/types/LedgerDestination";
import type { LedgerRuntime } from "src/types/LedgerRuntime";
import type { ReportBackend } from "src/types/ReportBackend";
import type { SimulatedProviders } from "src/types/SimulatedProviders";
import { INITIAL_ACCOUNT } from "src/utils/constants/accounts";
import { switchAccount } from "src/utils/switchAccount";

type ApplicationProps = {
  backend: ReportBackend;
  providers: SimulatedProviders;
  runtime: LedgerRuntime;
};

export const Application: React.FunctionComponent<ApplicationProps> = ({
  backend,
  providers,
  runtime: initialRuntime,
}) => {
  const [account, setAccount] = useState<AccountId | null>(INITIAL_ACCOUNT);
  const [runtime, setRuntime] = useState(initialRuntime);

  // A page that is being hidden may never come back: send what is queued.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        return;
      }

      runtime.flare.flush({ timeout: 1_000 }).catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [runtime]);

  const handleAccountSelect = (next: AccountId | null) => {
    setAccount(next);
    switchAccount(runtime.flare, providers, next);
  };

  const handleReceipt = (
    receipt: Receipt<LedgerDestination>,
    action: string,
  ) => {
    runtime.track(receipt, action, account);
  };

  // A disposed Flare cannot start again, so a restart replaces it.
  const replaceRuntime = () => {
    runtime.dispose();

    const next = createLedgerRuntime({ backend, providers });

    switchAccount(next.flare, providers, account);
    setRuntime(next);

    return next;
  };

  const handleRestartPress = () => {
    replaceRuntime().flare.start();
  };

  const handleRestartUnstartedPress = () => {
    replaceRuntime();
  };

  const handleStartPress = () => {
    runtime.flare.start();
  };

  return (
    <FlareProvider flare={runtime.flare}>
      <Header />
      <main className="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6">
        <Hero />
        <Section
          id="app"
          hint="Pay INV-1042. The card is declined on purpose, and its report appears under Latest report. Then switch to Grace Hopper and pay: her report carries nothing of Ada's."
        >
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <LedgerApp
              account={account}
              onAccountSelect={handleAccountSelect}
              onReceipt={handleReceipt}
            />
            <LatestReportPanel runtime={runtime} />
          </div>
        </Section>
        <Section
          id="receipts"
          hint="Attach receipt.pdf as Ada, then switch to Grace before it fails. The upload was Ada's, so Flare sends it nowhere rather than as Grace's."
        >
          <ReceiptsPanel runtime={runtime} />
        </Section>
        <Section
          id="destinations"
          hint="Press Remind Northwind. A reminder is a message, which PostHog and Datadog skip, and the customer's address arrives as [email]."
        >
          <DestinationsPanel
            runtime={runtime}
            backend={backend}
            providers={providers}
          />
        </Section>
        <Section
          id="lab"
          hint="Take your API offline, then pay an invoice. Only your API fails; Sentry and the console still get the report."
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <LabPanel
              backend={backend}
              providers={providers}
              onReceipt={handleReceipt}
            />
            <NetworkPanel backend={backend} />
          </div>
        </Section>
        <Section
          id="timeline"
          hint="Press Restart without starting, pay, then press Start. The report waited in the buffer and went out once Flare started."
        >
          <TimelinePanel
            runtime={runtime}
            onRestartPress={handleRestartPress}
            onRestartUnstartedPress={handleRestartUnstartedPress}
            onStartPress={handleStartPress}
          />
        </Section>
      </main>
      <Footer />
      <FlareDevtools />
    </FlareProvider>
  );
};
