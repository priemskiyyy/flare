import type { LedgerFlare } from "src/types/LedgerFlare";

declare module "@priemskiyyy/flare-react" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface.
  interface Register {
    flare: LedgerFlare;
  }
}
