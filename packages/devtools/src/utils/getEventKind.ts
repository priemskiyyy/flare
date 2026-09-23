import type { FlareDiagnosticEvent } from "@priemskiyyy/flare";

import { assertUnreachable } from "src/utils/assertUnreachable";

export type RecordedEventKind =
  "ERROR" | "REPORT" | "DESTINATION" | "SESSION" | "RUNTIME";

const REFUSALS = new Set([
  "report dropped",
  "rate limit reached",
  "session change rejected",
]);

const isSubmitted = (context: unknown) =>
  typeof context === "object" &&
  context !== null &&
  "status" in context &&
  context.status === "submitted";

export const getEventKind = (
  event: Pick<FlareDiagnosticEvent, "source" | "type" | "context">,
): RecordedEventKind => {
  if (REFUSALS.has(event.type) || event.type.endsWith(" failed")) {
    return "ERROR";
  }

  if (event.type === "destination outcome" && !isSubmitted(event.context)) {
    return "ERROR";
  }

  if (event.source === "report") {
    return "REPORT";
  }

  if (event.source === "destination") {
    return "DESTINATION";
  }

  if (event.source === "session") {
    return "SESSION";
  }

  if (event.source === "runtime") {
    return "RUNTIME";
  }

  return assertUnreachable(event.source);
};
