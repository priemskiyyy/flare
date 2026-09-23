type Context = Record<string, unknown>;

const isRecord = (value: unknown): value is Context =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const copyArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...value];
};

const copyRecord = (value: unknown): Context => {
  if (!isRecord(value)) {
    return {};
  }

  return { ...value };
};

// Datadog's `combine`: objects merge key by key and the later source wins,
// arrays merge by index, and a key named `__proto__` is skipped at any depth.
const merge = (destination: unknown, source: unknown): unknown => {
  if (source === undefined) {
    return destination;
  }

  if (Array.isArray(source)) {
    const merged = copyArray(destination);

    for (const [index, item] of source.entries()) {
      merged[index] = merge(merged[index], item);
    }

    return merged;
  }

  if (!isRecord(source)) {
    return source;
  }

  const merged = copyRecord(destination);

  for (const [key, value] of Object.entries(source)) {
    if (key === "__proto__") {
      continue;
    }

    merged[key] = merge(merged[key], value);
  }

  return merged;
};

// Datadog follows `cause` into the error's causes, at most ten deep, and
// names an error without a message "Empty message".
const describeError = (error: Error) => {
  const field: Context = {
    kind: error.name,
    message: error.message,
    stack: error.stack,
    handling: "handled",
  };

  if (error.message === "") {
    field.message = "Empty message";
  }

  const causes: Array<{ type: string; message: string }> = [];
  let current = error.cause;

  while (current instanceof Error && causes.length < 10) {
    causes.push({ type: current.name, message: current.message });
    current = current.cause;
  }

  if (causes.length > 0) {
    field.causes = causes;
  }

  return field;
};

/**
 * `datadogLogs` for the tests, modelled on `@datadog/browser-logs` 7.13. It
 * assembles each log the way the SDK does: the global context and the user
 * first, then the log's own fields and context merged over them, so a log's
 * context wins. `beforeSend`, sampling and rate limits can discard a log, and
 * `log` answers nothing either way.
 */
export const fakeDatadogLogs = ({
  initialized = true,
}: { initialized?: boolean } = {}) => {
  const state: {
    initConfiguration: Context | undefined;
    user: Context;
    globalContext: Context;
    /** Makes `beforeSend` discard every log, as sampling and rate limits also can. */
    discard: boolean;
  } = {
    initConfiguration: undefined,
    user: {},
    globalContext: {},
    discard: false,
  };

  if (initialized) {
    state.initConfiguration = { clientToken: "pub" };
  }

  const logs: Context[] = [];
  const calls = { init: 0, getInitConfiguration: 0, getUser: 0, log: 0 };

  const sdk = {
    init: (configuration: Context) => {
      calls.init += 1;
      state.initConfiguration = configuration;
    },
    getInitConfiguration: () => {
      calls.getInitConfiguration += 1;

      return state.initConfiguration;
    },
    setUser: (user: Context) => {
      state.user = { ...user };
    },
    clearUser: () => {
      state.user = {};
    },
    getUser: () => {
      calls.getUser += 1;

      return { ...state.user };
    },
    setGlobalContextProperty: (key: string, value: unknown) => {
      state.globalContext[key] = value;
    },
    logger: {
      log: (
        message: string,
        messageContext?: object,
        status = "info",
        error?: Error,
      ) => {
        calls.log += 1;

        if (state.discard) {
          return;
        }

        let context: unknown = merge({}, messageContext);

        if (error !== undefined) {
          context = merge({ error: describeError(error) }, context);
        }

        const defaults: Context = { ...state.globalContext };

        if (Object.keys(state.user).length > 0) {
          defaults.usr = { ...state.user };
        }

        const log = merge(
          defaults,
          merge({ message, status, origin: "logger" }, context),
        );

        if (isRecord(log)) {
          logs.push(log);
        }
      },
    },
  };

  return { sdk, state, logs, calls };
};
