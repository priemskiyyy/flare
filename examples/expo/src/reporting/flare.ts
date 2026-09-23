import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";

import { LEDGER_PRIVACY } from "examples/shared/ledger/constants/ledgerPrivacy";
import { LEDGER_SCHEMA } from "examples/shared/ledger/constants/ledgerSchema";
import { REPORTS_URL } from "src/utils/constants/reportsUrl";

/** Ledger's reporting on a phone: your API over the network, and the Metro console. */
export const flare = new Flare({
  destinations: {
    backend: http({
      request: async ({ report, signal }) => {
        const response = await fetch(REPORTS_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": report.id,
          },
          body: JSON.stringify(report),
          signal,
        });

        if (!response.ok) {
          throw new Error(`The report endpoint answered ${response.status}.`);
        }

        const answer: unknown = await response.json();

        if (
          typeof answer !== "object" ||
          answer === null ||
          !("id" in answer) ||
          typeof answer.id !== "string"
        ) {
          throw new Error("The report endpoint answered without an id.");
        }

        return { id: answer.id };
      },
    }),
    console: console(),
  },
  schema: LEDGER_SCHEMA,
  privacy: LEDGER_PRIVACY,
  // Short enough for the server's 8 s latency to end unconfirmed.
  timeout: 3_000,
});
