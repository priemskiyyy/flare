import type { flare } from "src/reporting/flare";

declare module "@priemskiyyy/flare-react" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface.
  interface Register {
    flare: typeof flare;
  }
}
