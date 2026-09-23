import type { DestinationOutcome } from "@priemskiyyy/flare";

import {
  BILLING_DESTINATIONS,
  DESTINATION_GUIDES,
} from "examples/shared/ledger/constants/destinations";
import { formatError } from "examples/shared/ledger/formatting/formatError";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { assertUnreachable } from "examples/shared/ledger/utils/assertUnreachable";

type Outcome<TStatus extends DestinationOutcome["status"]> = Extract<
  DestinationOutcome,
  { status: TStatus }
>;

const explainNotRouted = (destination: LedgerDestination) => {
  if (BILLING_DESTINATIONS.includes(destination)) {
    return "Only billing reports come here.";
  }

  return "Billing reports hold payment details, so they never come here.";
};

const explainSubmitted = ({ evidence, event }: Outcome<"submitted">) => {
  if (evidence === "backend-acknowledged") {
    return "Your API acknowledged this exact report.";
  }

  if (evidence === "sdk-callback-completed") {
    return "The SDK called back when it was done.";
  }

  if (evidence === "sdk-call-returned") {
    if (event === null) {
      return "The SDK took it. That is as far as Flare can see.";
    }

    return `The SDK took it as ${event.id}. That is as far as Flare can see.`;
  }

  return assertUnreachable(evidence);
};

const explainSkipped = (label: string, { reason }: Outcome<"skipped">) => {
  if (reason === "unsupported-report-kind") {
    return `${label} records errors, not messages.`;
  }

  if (reason === "identity-mismatch") {
    return `${label} would file it under the user it knows now, someone else.`;
  }

  if (reason === "auth-subject-mismatch") {
    return "The account changed, and your API would get the new account's credentials.";
  }

  if (reason === "start-failed") {
    return `${label} never started, so it was never tried.`;
  }

  return assertUnreachable(reason);
};

const explainDropped = (label: string, { reason }: Outcome<"dropped">) => {
  if (reason === "deduped") {
    return "Already sent: the same error, again within a second.";
  }

  if (reason === "provider-filtered") {
    return `${label}'s own filters dropped it, and its SDK said so.`;
  }

  if (reason === "buffer-expired") {
    return "It waited too long for the destination to start.";
  }

  if (reason === "buffer-overflow") {
    return "Newer reports pushed it out of the startup buffer.";
  }

  if (reason === "disposed") {
    return "The demo restarted before it was sent.";
  }

  return assertUnreachable(reason);
};

const explainIndeterminate = ({ reason }: Outcome<"indeterminate">) => {
  if (reason === "timeout") {
    return "No answer within 3 seconds. It may still arrive.";
  }

  if (reason === "disposed") {
    return "The demo restarted while it was being sent.";
  }

  if (reason === "ambiguous") {
    return "The SDK finished after the report had already settled.";
  }

  return assertUnreachable(reason);
};

/** A destination's part in one report, in words: `undefined` when it was not routed, `null` until it answers. */
export const explainOutcome = (
  destination: LedgerDestination,
  outcome: DestinationOutcome | null | undefined,
) => {
  const label = DESTINATION_GUIDES[destination].name;

  if (outcome === undefined) {
    return explainNotRouted(destination);
  }

  if (outcome === null) {
    return "Waiting for its answer.";
  }

  if (outcome.status === "submitted") {
    return explainSubmitted(outcome);
  }

  if (outcome.status === "skipped") {
    return explainSkipped(label, outcome);
  }

  if (outcome.status === "dropped") {
    return explainDropped(label, outcome);
  }

  if (outcome.status === "failed") {
    return formatError(outcome.error);
  }

  if (outcome.status === "indeterminate") {
    return explainIndeterminate(outcome);
  }

  return assertUnreachable(outcome);
};
