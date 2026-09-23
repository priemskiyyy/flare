import { Flare, isSensitiveKey } from "@priemskiyyy/flare";
import type { SanitizedReport } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import type { ConsoleWriter } from "@priemskiyyy/flare-console";
import { datadog } from "@priemskiyyy/flare-datadog";
import { http } from "@priemskiyyy/flare-http";
import { posthog } from "@priemskiyyy/flare-posthog";
import { sentry } from "@priemskiyyy/flare-sentry";
import { z } from "zod";

import type { ReportBackend } from "src/types/ReportBackend";
import type { SimulatedProviders } from "src/types/SimulatedProviders";
import {
  BILLING_DESTINATIONS,
  PRODUCT_DESTINATIONS,
} from "src/utils/constants/destinations";

// A letter-only top-level domain, so a package version such as react@19.2.0 in a
// stack frame is not taken for an address.
const EMAIL = /[\w.+-]+@(?:[\w-]+\.)+[a-z]{2,}/gi;

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
    schema: {
      tags: {
        area: z.enum(["billing", "attachments", "preview", "reminders"]),
        plan: z.enum(["free", "pro"]),
      },
      contexts: {
        company: z.object({ name: z.string() }),
        payment: z.object({
          invoice: z.string(),
          amount: z.number(),
          cardToken: z.string(),
          iban: z.string(),
        }),
        react: z.object({ componentStack: z.string() }),
      },
      breadcrumbs: {
        signedIn: z.object({ company: z.string() }),
        invoiceOpened: z.object({ invoice: z.string() }),
        attachmentStarted: z.object({ file: z.string() }),
      },
    },
    privacy: {
      // The defaults cover the card token; an IBAN is as sensitive.
      redact: (key) => isSensitiveKey(key) || key === "iban",
      // Customer addresses turn up in messages, where no key names them.
      scrub: (text) => text.replaceAll(EMAIL, "[email]"),
    },
    // Short enough for the lab's 8 s latency to end unconfirmed.
    timeout: 3_000,
  });
