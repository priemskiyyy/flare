import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";
import type { FetchLike } from "@priemskiyyy/flare-http";
import { z } from "zod";

/** The same configuration is used by the browser and each isolated example test. */
export const createExampleFlare = ({ fetch }: { fetch: FetchLike }) =>
  new Flare({
    destinations: {
      backend: http({ endpoint: "/api/error-reports", fetch }),
      console: consoleReporter(),
    },
    schema: {
      tags: { area: z.enum(["checkout", "upload", "widget"]) },
      contexts: {
        payment: z.object({ cardToken: z.string(), amount: z.number() }),
        react: z.object({ componentStack: z.string() }),
      },
      breadcrumbs: {
        signedIn: z.object({ name: z.string() }),
        uploadStarted: z.object({ file: z.object({ name: z.string() }) }),
      },
    },
  });

declare module "@priemskiyyy/flare-react" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface.
  interface Register {
    flare: ReturnType<typeof createExampleFlare>;
  }
}
