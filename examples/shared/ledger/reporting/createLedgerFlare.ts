import { Flare } from "@priemskiyyy/flare";
import type { SanitizedReport } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import type { ConsoleWriter } from "@priemskiyyy/flare-console";
import { datadog } from "@priemskiyyy/flare-datadog";
import { http } from "@priemskiyyy/flare-http";
import { posthog } from "@priemskiyyy/flare-posthog";
import { sentry } from "@priemskiyyy/flare-sentry";

import {
  BILLING_DESTINATIONS,
  PRODUCT_DESTINATIONS,
} from "examples/shared/ledger/constants/destinations";
import { LEDGER_PRIVACY } from "examples/shared/ledger/constants/ledgerPrivacy";
import { LEDGER_SCHEMA } from "examples/shared/ledger/constants/ledgerSchema";
import type { ReportBackend } from "examples/shared/ledger/types/ReportBackend";
import type { SimulatedProviders } from "examples/shared/ledger/types/SimulatedProviders";

const routeReport = ({ report }: { report: SanitizedReport }) => {
  if (report.tags.area === "billing") {
    return BILLING_DESTINATIONS;
  }

  return PRODUCT_DESTINATIONS;
};

type LedgerFlareOptions = {
  backend: ReportBackend;
  providers: SimulatedProviders;
  writer: ConsoleWriter;
};

/** Ledger's reporting, in one place: where reports go, what they may hold, and what never leaves. */
export const createLedgerFlare = ({
  backend,
  providers,
  writer,
}: LedgerFlareOptions) =>
  new Flare({
    destinations: {
      backend: http({ request: backend.request }),
      console: console({ writer }),
      sentry: sentry({ sdk: providers.sentry.sdk }),
      posthog: posthog({ sdk: providers.posthog.sdk }),
      datadog: datadog({ sdk: providers.datadog.sdk }),
    },
    defaults: { to: routeReport },
    schema: LEDGER_SCHEMA,
    privacy: LEDGER_PRIVACY,
    // Short enough for the lab's 8 s latency to end unconfirmed.
    timeout: 3_000,
  });
