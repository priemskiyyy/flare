type Context = Record<string, unknown>;

type AssembledError = {
  error: {
    type: string;
    message: string;
    causes: Array<{ type: string; message: string }>;
  };
  context: unknown;
  /** Absent when no user is set, as Datadog leaves it out. */
  usr?: Context;
};

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

// Datadog follows `cause` into the error's causes, at most ten deep.
const describeError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { type: "Error", message: String(error), causes: [] };
  }

  const causes: Array<{ type: string; message: string }> = [];
  let current = error.cause;

  while (current instanceof Error && causes.length < 10) {
    causes.push({ type: current.name, message: current.message });
    current = current.cause;
  }

  return { type: error.name, message: error.message, causes };
};

/**
 * `datadogRum` for the tests, modelled on `@datadog/browser-rum` 7.13. It
 * assembles each error the way RUM does: the error's own attributes first,
 * then the global context merged over them and the current user beside them.
 * `beforeSend` can discard an error, and `addError` answers nothing either
 * way.
 */
export const fakeDatadogRum = ({
  initialized = true,
}: { initialized?: boolean } = {}) => {
  const state: {
    initConfiguration: Context | undefined;
    user: Context;
    globalContext: Context;
    /** Makes `beforeSend` discard every error, as sampling and rate limits also can. */
    discard: boolean;
  } = {
    initConfiguration: undefined,
    user: {},
    globalContext: {},
    discard: false,
  };

  if (initialized) {
    state.initConfiguration = { applicationId: "app" };
  }

  const errors: AssembledError[] = [];
  const calls = { init: 0, getInitConfiguration: 0, getUser: 0, addError: 0 };

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
    addError: (error: unknown, context?: object) => {
      calls.addError += 1;

      if (state.discard) {
        return;
      }

      const assembled: AssembledError = {
        error: describeError(error),
        context: merge(merge({}, context), state.globalContext),
      };

      if (Object.keys(state.user).length > 0) {
        assembled.usr = { ...state.user };
      }

      errors.push(assembled);
    },
  };

  return { sdk, state, errors, calls };
};
