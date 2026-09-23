import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { ReportDropReason } from "src/types/ReportDropReason";

/**
 * Where a report stands. `dropped` means it never reached a destination. While
 * `pending`, a destination still in flight has a `null` outcome. `settled`
 * means every selected destination answered or hit the deadline.
 */
export type ReceiptStatus<TName extends string = string> =
  | { readonly state: "dropped"; readonly reason: ReportDropReason }
  | {
      readonly state: "pending";
      readonly outcomes: Readonly<
        Partial<Record<TName, DestinationOutcome | null>>
      >;
    }
  | {
      readonly state: "settled";
      readonly outcomes: Readonly<Partial<Record<TName, DestinationOutcome>>>;
    };
