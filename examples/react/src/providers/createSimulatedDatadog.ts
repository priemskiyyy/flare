import type { DatadogRumLike } from "@priemskiyyy/flare-datadog";

import { formatError } from "src/formatting/formatError";
import type { ProviderEvent } from "src/types/ProviderEvent";
import { createEventLog } from "src/utils/createEventLog";
import { readString } from "src/utils/readString";

/** What Flare calls, and what the application calls on sign-in and sign-out. */
type SimulatedRum = DatadogRumLike & {
  setUser: (user: Record<string, unknown>) => void;
  clearUser: () => void;
};

const readReportId = (context: object) => {
  if (!("flare" in context)) {
    return null;
  }

  const { flare } = context;

  if (typeof flare !== "object" || flare === null || !("report_id" in flare)) {
    return null;
  }

  return readString(flare.report_id);
};

/**
 * Datadog RUM inside the page. It attaches the user it was given to every
 * error, as RUM does, and keeps each error in an inbox.
 */
export const createSimulatedDatadog = () => {
  const inbox = createEventLog<ProviderEvent>(20);
  let user: Record<string, unknown> = {};
  let nextId = 1;

  const sdk: SimulatedRum = {
    getInitConfiguration: () => ({ applicationId: "ledger" }),
    getUser: () => ({ ...user }),
    addError: (error: unknown, context: object = {}) => {
      inbox.add({
        id: `datadog_${nextId}`,
        reportId: readReportId(context),
        title: formatError(error),
        user: readString(user.id),
        body: { error: formatError(error), context, usr: user },
        at: Date.now(),
      });
      nextId += 1;
    },
    setUser: (next: Record<string, unknown>) => {
      user = { ...next };
    },
    clearUser: () => {
      user = {};
    },
  };

  return { sdk, inbox: inbox.log };
};
