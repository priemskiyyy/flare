import { ArrowsClockwise, Plugs } from "@phosphor-icons/react";
import type { FlareFlushResult } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-react";
import type React from "react";
import { useState } from "react";

import { DESTINATION_NAMES } from "examples/shared/ledger/constants/destinations";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
import type { ReportBackend } from "examples/shared/ledger/types/ReportBackend";
import type { SimulatedProviders } from "examples/shared/ledger/types/SimulatedProviders";
import { assertUnreachable } from "examples/shared/ledger/utils/assertUnreachable";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import { DestinationCard } from "src/components/Destinations/DestinationCard";
import { Panel } from "src/components/Panel/Panel";
import { useEventLog } from "src/hooks/useEventLog";

type DestinationsPanelProps = {
  runtime: LedgerRuntime;
  backend: ReportBackend;
  providers: SimulatedProviders;
};

export const DestinationsPanel: React.FunctionComponent<
  DestinationsPanelProps
> = ({ runtime, backend, providers }) => {
  const flare = useFlare();

  const [flushed, setFlushed] =
    useState<FlareFlushResult<LedgerDestination> | null>(null);

  const requests = useEventLog(backend.requests);
  const consoleLines = useEventLog(runtime.consoleLines);
  const sentry = useEventLog(providers.sentry.inbox);
  const posthog = useEventLog(providers.posthog.inbox);
  const datadog = useEventLog(providers.datadog.inbox);

  const getLastReceived = (name: LedgerDestination) => {
    if (name === "backend") {
      const accepted = requests.find(({ outcome }) => outcome === "accepted");

      return accepted?.reportId ?? null;
    }

    if (name === "console") {
      return consoleLines[0]?.line ?? null;
    }

    if (name === "sentry") {
      return sentry[0]?.title ?? null;
    }

    if (name === "posthog") {
      return posthog[0]?.title ?? null;
    }

    if (name === "datadog") {
      return datadog[0]?.title ?? null;
    }

    return assertUnreachable(name);
  };

  const handleFlushPress = async () => {
    setFlushed(await flare.flush());
  };

  return (
    <Panel
      title="Destinations"
      icon={Plugs}
      shows="Every destination is a real Flare adapter. The SDKs and the backend behind them are simulated in the page."
      aside={
        <button
          type="button"
          onClick={handleFlushPress}
          className={buttonStyles({ size: "small" })}
        >
          <ArrowsClockwise aria-hidden="true" size={14} weight="bold" />
          Flush
        </button>
      }
    >
      <ul
        aria-label="Destinations"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {DESTINATION_NAMES.map((name) => (
          <DestinationCard
            key={name}
            name={name}
            lastReceived={getLastReceived(name)}
            flush={flushed?.destinations[name] ?? null}
          />
        ))}
      </ul>
    </Panel>
  );
};
