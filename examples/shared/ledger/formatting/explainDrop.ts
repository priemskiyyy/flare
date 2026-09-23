import type { ReportDropReason } from "@priemskiyyy/flare";

import { assertUnreachable } from "examples/shared/ledger/utils/assertUnreachable";

/** Why a report reached no destination at all, in words. */
export const explainDrop = (reason: ReportDropReason) => {
  if (reason === "stale-scope") {
    return "The account changed while it ran. It belonged to the previous account, so Flare sent it nowhere rather than as the new one.";
  }

  if (reason === "sanitizer-failed") {
    return "It could not be redacted, so it was not sent at all.";
  }

  if (reason === "route-failed") {
    return "Its routing rule threw, so it went nowhere rather than somewhere wrong.";
  }

  if (reason === "no-destinations") {
    return "Routing chose no destination.";
  }

  if (reason === "rate-limited") {
    return "More reports than the rate limit allows this minute.";
  }

  if (reason === "reentrant") {
    return "It was captured from inside a destination, which could loop forever.";
  }

  if (reason === "disposed") {
    return "It was captured after the demo restarted.";
  }

  return assertUnreachable(reason);
};
