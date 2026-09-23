import type {
  SentryEventLike,
  SentryLike,
  SentryScopeLike,
} from "@priemskiyyy/flare-sentry";

import { formatError } from "examples/shared/ledger/formatting/formatError";
import type { ProviderEvent } from "examples/shared/ledger/types/ProviderEvent";
import { createEventLog } from "examples/shared/ledger/utils/createEventLog";
import { createValueStore } from "examples/shared/ledger/utils/createValueStore";
import { readString } from "examples/shared/ledger/utils/readString";

type EventProcessor = (event: SentryEventLike) => SentryEventLike;

/**
 * A Sentry SDK inside the page. It runs a scope's event processors as Sentry
 * does, and keeps what it would send in an inbox instead of sending it.
 */
export const createSimulatedSentry = () => {
  const inbox = createEventLog<ProviderEvent>(20);
  const initialized = createValueStore(true);
  let processors: EventProcessor[] = [];
  let nextId = 1;

  const capture = (title: string) => {
    let event: SentryEventLike = {};

    for (const processor of processors) {
      event = processor(event);
    }

    const id = `sentry_${nextId}`;

    nextId += 1;
    inbox.add({
      id,
      reportId: readString(event.tags?.["flare.report_id"]),
      title,
      user: readString(event.user?.id),
      body: event,
      at: Date.now(),
    });

    return id;
  };

  const sdk = {
    setUser: () => {},
    setTags: () => {},
    setContext: () => {},
    addBreadcrumb: () => {},
    withScope: <TResult>(callback: (scope: SentryScopeLike) => TResult) => {
      const forked: EventProcessor[] = [];

      processors = forked;

      try {
        return callback({
          addEventProcessor: (processor) => {
            forked.push(processor);
          },
        });
      } finally {
        processors = [];
      }
    },
    captureException: (exception: unknown) => capture(formatError(exception)),
    captureMessage: (message: string) => capture(message),
    flush: async () => true,
    getClient: () => {
      if (!initialized.get()) {
        return undefined;
      }

      return { dsn: "https://public@sentry.test/1" };
    },
    getIsolationScope: () => ({ clearBreadcrumbs: () => {} }),
  } satisfies SentryLike;

  return { sdk, inbox: inbox.log, initialized };
};
