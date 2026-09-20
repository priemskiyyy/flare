import type { ObservableValue } from "src/types/ObservableValue";
import type { ReceiptStatus } from "src/types/ReceiptStatus";

/**
 * Returned synchronously by `capture()` and `message()`. Most callers ignore
 * it. `settled` resolves once the report is dropped or every selected
 * destination has settled, and it never rejects: a provider failure is an
 * outcome, not an exception.
 *
 * @example
 * ```ts
 * const receipt = flare.capture(error);
 * const status = await receipt.settled;
 * ```
 */
export type Receipt<TName extends string = string> = {
  id: string;
  status: ObservableValue<ReceiptStatus<TName>>;
  settled: Promise<ReceiptStatus<TName>>;
};
