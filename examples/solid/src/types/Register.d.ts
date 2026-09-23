import type { LedgerFlare } from "examples/shared/ledger/types/LedgerFlare";

declare module "@priemskiyyy/flare-solid" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface.
  interface Register {
    flare: LedgerFlare;
  }
}
