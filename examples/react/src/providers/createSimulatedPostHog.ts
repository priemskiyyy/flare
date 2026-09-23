import type { PostHogLike } from "@priemskiyyy/flare-posthog";

import { formatError } from "src/formatting/formatError";
import type { ProviderEvent } from "src/types/ProviderEvent";
import { createEventLog } from "src/utils/createEventLog";
import { createValueStore } from "src/utils/createValueStore";
import { readString } from "src/utils/readString";

const ANONYMOUS = "anonymous";

/** What Flare calls, and what the application calls on sign-in and sign-out. */
type SimulatedPostHog = PostHogLike & {
  identify: (distinctId: string) => void;
  reset: () => void;
};

/**
 * A posthog-js instance inside the page. It files every event under the
 * person it identifies, and the lab can make its filters drop every event.
 */
export const createSimulatedPostHog = () => {
  const inbox = createEventLog<ProviderEvent>(20);
  const filtering = createValueStore(false);
  let distinctId = ANONYMOUS;
  let nextId = 1;

  const sdk: SimulatedPostHog = {
    __loaded: true,
    exceptions: {},
    get_distinct_id: () => distinctId,
    captureException: (
      error: unknown,
      properties: Record<string, unknown> = {},
    ) => {
      if (filtering.get()) {
        return undefined;
      }

      const uuid = `posthog_${nextId}`;

      nextId += 1;
      inbox.add({
        id: uuid,
        reportId: readString(properties["flare.report_id"]),
        title: formatError(error),
        user: distinctId,
        body: { event: "$exception", distinct_id: distinctId, properties },
        at: Date.now(),
      });

      return { uuid };
    },
    identify: (next: string) => {
      distinctId = next;
    },
    reset: () => {
      distinctId = ANONYMOUS;
    },
  };

  return { sdk, inbox: inbox.log, filtering };
};
