type Properties = Record<string, unknown>;

type CapturedEvent = {
  uuid: string;
  event: "$exception";
  properties: Properties;
};

const TOKEN = "phc_fake";

// posthog-js walks `cause` the same way into its exception list.
const toExceptionList = (error: unknown) => {
  const list: Properties[] = [];
  let current = error;

  while (current instanceof Error) {
    list.push({ type: current.name, value: current.message });
    current = current.cause;
  }

  return list;
};

// A slim bundle initialized without error tracking has no extension.
const createExtension = (included: boolean) => {
  if (!included) {
    return undefined;
  }

  return { name: "exceptions extension" };
};

const hasSteps = (properties: Properties) =>
  properties.$exception_steps !== undefined &&
  properties.$exception_steps !== null;

/**
 * posthog-js for the tests, modelled on version 1.434. `captureException`
 * assigns the caller's properties over the exception's own, attaches the
 * exception steps it buffered only when the caller brings none, and clears
 * them after any capture. The result is merged over the super properties and
 * the distinct id, on that event only, which is why a caller's `distinct_id`
 * would move the event to another person and a caller's `$set` would change
 * the person. Nothing is captured before `init`, and every filter answers
 * `undefined`.
 */
export const fakePostHog = ({
  loaded = true,
  exceptions = true,
}: { loaded?: boolean; exceptions?: boolean } = {}) => {
  const state: {
    distinctId: string;
    superProperties: Properties;
    /** Person properties changed by a `$set` on an event. */
    personProperties: Properties;
    steps: Properties[];
    /** Makes every capture answer `undefined`, as opt-out, a rate limit or `before_send` do. */
    filtered: boolean;
  } = {
    distinctId: "anonymous-1",
    superProperties: {},
    personProperties: {},
    steps: [],
    filtered: false,
  };

  const captured: CapturedEvent[] = [];
  const calls = { init: 0, captureException: 0, get_distinct_id: 0 };
  let anonymousCount = 1;

  const capture = (properties: Properties): CapturedEvent | undefined => {
    if (state.filtered) {
      return undefined;
    }

    const merged: Properties = Object.assign(
      {},
      state.superProperties,
      { distinct_id: state.distinctId },
      properties,
      { token: TOKEN },
    );

    const set = merged.$set;

    if (typeof set === "object" && set !== null) {
      Object.assign(state.personProperties, set);
    }

    const event: CapturedEvent = {
      uuid: `uuid-${captured.length + 1}`,
      event: "$exception",
      properties: merged,
    };

    captured.push(event);

    return event;
  };

  const sdk = {
    __loaded: loaded,
    exceptions: createExtension(exceptions),
    init: () => {
      calls.init += 1;
      sdk.__loaded = true;
    },
    get_distinct_id: () => {
      calls.get_distinct_id += 1;

      return state.distinctId;
    },
    identify: (distinctId: string) => {
      state.distinctId = distinctId;
    },
    reset: () => {
      anonymousCount += 1;
      state.distinctId = `anonymous-${anonymousCount}`;
      state.superProperties = {};
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
    captureException: (error: unknown, additionalProperties?: Properties) => {
      calls.captureException += 1;

      if (!sdk.__loaded || sdk.exceptions === undefined) {
        return undefined;
      }

      const properties: Properties = Object.assign(
        { $exception_list: toExceptionList(error), $exception_level: "error" },
        additionalProperties,
      );

      if (!hasSteps(properties) && state.steps.length > 0) {
        properties.$exception_steps = [...state.steps];
      }

      const event = capture(properties);

      if (event !== undefined) {
        state.steps = [];
      }

      return event;
    },
  };

  return { sdk, state, captured, calls };
};
