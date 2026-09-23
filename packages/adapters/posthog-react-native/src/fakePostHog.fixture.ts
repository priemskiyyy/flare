type Properties = Record<string, unknown>;

type QueuedEvent = {
  distinct_id: string;
  event: "$exception";
  properties: Properties;
};

// posthog-react-native walks `cause` the same way into its exception list.
const toExceptionList = (error: unknown) => {
  const list: Properties[] = [];
  let current = error;

  while (current instanceof Error) {
    list.push({ type: current.name, value: current.message });
    current = current.cause;
  }

  return list;
};

const hasSteps = (properties: Properties) =>
  properties.$exception_steps !== undefined &&
  properties.$exception_steps !== null;

/**
 * A posthog-react-native client for the tests, modelled on version 4.75.
 * `captureException` answers nothing: the event is queued, or dropped by a
 * disabled or opted-out client without a word. Until the client has loaded
 * its storage, `getDistinctId` is empty and a capture waits, then takes the
 * distinct id it finds. The caller's properties are spread over the
 * exception's own and over the super properties, while the queued event's
 * `distinct_id` is always the client's, and a `$groups` property registers
 * groups on the client itself. Buffered exception steps are attached only
 * when the caller brings none.
 */
export const fakePostHog = ({
  ready = true,
  disabled = false,
}: { ready?: boolean; disabled?: boolean } = {}) => {
  let resolveLoaded = () => {};

  const loaded = new Promise<void>((resolve) => {
    resolveLoaded = resolve;
  });

  const state: {
    initialized: boolean;
    disabled: boolean;
    optedOut: boolean;
    /** The distinct id in storage, which the client knows once it is ready. */
    distinctId: string;
    superProperties: Properties;
    steps: Properties[];
    /** Makes `flush` reject, as a batch the server refused does. */
    flushFailure: Error | null;
  } = {
    initialized: ready,
    disabled,
    optedOut: false,
    distinctId: "anonymous-1",
    superProperties: {},
    steps: [],
    flushFailure: null,
  };

  if (ready) {
    resolveLoaded();
  }

  const queue: QueuedEvent[] = [];
  const sent: QueuedEvent[] = [];
  const calls = { ready: 0, getDistinctId: 0, captureException: 0, flush: 0 };

  // `wrap` in @posthog/core: nothing at all while disabled, later while loading.
  const whenInitialized = (task: () => void) => {
    if (state.disabled) {
      return;
    }

    if (state.initialized) {
      task();

      return;
    }

    loaded.then(task, () => {});
  };

  const capture = (properties: Properties) => {
    whenInitialized(() => {
      const distinctId = state.distinctId;
      const groups = properties.$groups;

      if (typeof groups === "object" && groups !== null) {
        state.superProperties.$groups = groups;
      }

      const enriched: Properties = {
        ...state.superProperties,
        ...properties,
        $lib: "posthog-react-native",
        $session_id: "session-1",
      };

      if (state.optedOut) {
        return;
      }

      queue.push({
        distinct_id: distinctId,
        event: "$exception",
        properties: enriched,
      });
    });
  };

  const sdk = {
    ready: () => {
      calls.ready += 1;

      return loaded;
    },
    getDistinctId: () => {
      calls.getDistinctId += 1;

      if (!state.initialized) {
        return "";
      }

      return state.distinctId;
    },
    identify: (distinctId: string) => {
      state.distinctId = distinctId;
    },
    register: (properties: Properties) => {
      Object.assign(state.superProperties, properties);
    },
    addExceptionStep: (message: string, properties: Properties = {}) => {
      state.steps.push({
        ...properties,
        $message: message,
        $timestamp: new Date().toISOString(),
      });
    },
    captureException(error: unknown, additionalProperties: Properties = {}) {
      calls.captureException += 1;

      let properties: Properties = {
        $app_state: "active",
        ...additionalProperties,
      };

      if (!hasSteps(properties) && state.steps.length > 0) {
        properties = { ...properties, $exception_steps: [...state.steps] };
      }

      capture({
        $exception_list: toExceptionList(error),
        $exception_level: "error",
        ...properties,
      });
    },
    flush: async () => {
      calls.flush += 1;

      if (state.disabled) {
        return;
      }

      await loaded;

      if (state.flushFailure !== null) {
        throw state.flushFailure;
      }

      sent.push(...queue.splice(0));
    },
  };

  return {
    sdk,
    state,
    queue,
    sent,
    calls,
    /** What the client does once its storage has loaded. */
    finishLoading: () => {
      state.initialized = true;
      resolveLoaded();
    },
  };
};
