import {
  Bug,
  Copy,
  Flask,
  Funnel,
  Power,
  WifiSlash,
} from "@phosphor-icons/react";
import { useFlare } from "@priemskiyyy/flare-react";
import type { Receipt } from "@priemskiyyy/flare";
import clsx from "clsx";
import type React from "react";

import { LabControl } from "src/components/Lab/LabControl";
import { LabField } from "src/components/Lab/LabField";
import { SegmentedControl } from "src/components/SegmentedControl/SegmentedControl";
import { useObservable } from "src/hooks/useObservable";
import { CARD_CLASS_NAME } from "src/styles/cardStyles";
import type { LedgerDestination } from "src/types/LedgerDestination";
import type { ReportBackend } from "src/types/ReportBackend";
import type { SimulatedProviders } from "src/types/SimulatedProviders";
import { LATENCY_OPTIONS } from "src/utils/constants/labOptions";

type LabPanelProps = {
  backend: ReportBackend;
  providers: SimulatedProviders;
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const LabPanel: React.FunctionComponent<LabPanelProps> = ({
  backend,
  providers,
  onReceipt,
}) => {
  const flare = useFlare();
  const state = useObservable(backend.state);
  const filtering = useObservable(providers.posthog.filtering);
  const sentryInitialized = useObservable(providers.sentry.initialized);

  // The same object twice, within dedupe's one-second window.
  const handleReportTwicePress = () => {
    const thrown = new Error("The sync of INV-1042 conflicted");

    onReceipt(
      flare.capture(thrown, { tags: { area: "attachments" } }),
      "Sync INV-1042",
    );
    onReceipt(
      flare.capture(thrown, { tags: { area: "attachments" } }),
      "Sync INV-1042 again",
    );
  };

  return (
    <section
      aria-label="Lab"
      className={clsx(
        "flex h-full min-w-0 flex-col gap-5 border-dashed p-5",
        CARD_CLASS_NAME,
      )}
    >
      <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-stone-800 dark:text-stone-200">
        <Flask
          aria-hidden="true"
          size={18}
          weight="duotone"
          className="text-amber-600 dark:text-amber-400"
        />
        Lab
      </h3>
      <LabField label="API latency">
        <SegmentedControl
          label="API latency"
          options={LATENCY_OPTIONS}
          value={state.latency}
          onSelect={backend.setLatency}
        />
      </LabField>
      <ul className="grid gap-3 sm:grid-cols-2">
        <LabControl
          icon={WifiSlash}
          label="API offline"
          description="Your API answers 503. Its outcome fails, and every other destination still gets the report."
          pressed={state.offline}
          onPress={() => backend.setOffline(!state.offline)}
        />
        <LabControl
          icon={Bug}
          label="Fail next request"
          description="The next request answers 503 once. The report is not sent again: a retry is your client's to make."
          pressed={state.failNext}
          onPress={backend.failNextRequest}
        />
        <LabControl
          icon={Funnel}
          label="PostHog filters everything"
          description="PostHog's own filters drop each event, which its SDK says, so the outcome is dropped, not submitted."
          pressed={filtering}
          onPress={() => providers.posthog.filtering.set(!filtering)}
        />
        <LabControl
          icon={Power}
          label="Sentry not initialized"
          description="Restart the runtime: Sentry's start fails, its reports wait in the buffer, and Start retries once it is back."
          pressed={!sentryInitialized}
          onPress={() => providers.sentry.initialized.set(!sentryInitialized)}
        />
        <LabControl
          icon={Copy}
          label="Report twice"
          description="Captures the same error object twice. Every destination drops the second as a duplicate."
          pressed={false}
          onPress={handleReportTwicePress}
        />
      </ul>
    </section>
  );
};
