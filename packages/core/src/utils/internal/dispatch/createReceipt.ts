import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { Receipt } from "src/types/Receipt";
import type { ReceiptStatus } from "src/types/ReceiptStatus";
import type { ReportDropReason } from "src/types/ReportDropReason";
import { deferred } from "src/utils/common/deferred";
import { ValueStore } from "src/utils/common/ValueStore";

const hasAllOutcomes = <TName extends string>(
  outcomes: Partial<Record<TName, DestinationOutcome | null>>,
): outcomes is Partial<Record<TName, DestinationOutcome>> =>
  Object.values(outcomes).every((outcome) => outcome !== null);

/**
 * A receipt plus the two ways the core can finish it. The first answer of a
 * destination stands: a provider that answers after the deadline is ignored.
 */
export const createReceipt = <TName extends string>(
  id: string,
  names: readonly TName[],
) => {
  const unanswered: Partial<Record<TName, DestinationOutcome | null>> =
    Object.create(null);
  for (const name of names) {
    unanswered[name] = null;
  }

  const status = new ValueStore<ReceiptStatus<TName>>(
    Object.freeze({ state: "pending", outcomes: Object.freeze(unanswered) }),
  );
  const completion = deferred<ReceiptStatus<TName>>();

  const finish = (final: ReceiptStatus<TName>) => {
    status.set(final);
    completion.resolve(final);
  };

  const receipt: Receipt<TName> = {
    id,
    status: { get: status.get, subscribe: status.subscribe },
    settled: completion.promise,
  };

  return {
    receipt,
    drop: (reason: ReportDropReason) => {
      if (status.get().state !== "pending") {
        return;
      }
      finish(Object.freeze({ state: "dropped", reason }));
    },
    settle: (name: TName, outcome: DestinationOutcome) => {
      const current = status.get();
      if (current.state !== "pending") {
        return;
      }

      // `undefined` was never selected and anything else has already answered.
      if (current.outcomes[name] !== null) {
        return;
      }

      const outcomes = Object.freeze({
        ...current.outcomes,
        [name]: Object.freeze(outcome),
      });
      if (hasAllOutcomes(outcomes)) {
        finish(Object.freeze({ state: "settled", outcomes }));
        return;
      }

      status.set(Object.freeze({ state: "pending", outcomes }));
    },
  };
};
