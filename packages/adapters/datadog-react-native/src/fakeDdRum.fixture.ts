type Attributes = Record<string, unknown>;

type RecordedError = {
  message: string;
  source: string;
  stacktrace: string;
  /** Flattened with dot paths, as they reach the native SDK. */
  attributes: Attributes;
  timestampMs: number;
  /** What the native SDK attaches by itself: the user set at that moment. */
  user: Attributes | undefined;
};

const isPrimitive = (value: unknown) =>
  value === null ||
  value === undefined ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

// The SDK's own test for an object it can encode.
const isPlainObject = (value: unknown): value is Attributes =>
  typeof value === "object" && value !== null && value.constructor === Object;

// `encodeAttributes`: plain objects are flattened into dot paths, arrays are
// kept whole, and any other object is dropped with a warning.
const encode = (value: unknown, path: string[], out: Attributes) => {
  if (isPrimitive(value)) {
    out[path.join(".")] = value;

    return;
  }

  if (Array.isArray(value)) {
    out[path.join(".")] = value
      .map(normalize)
      .filter((item) => item !== undefined);

    return;
  }

  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      encode(entry, [...path, key], out);
    }
  }
};

const normalize = (item: unknown): unknown => {
  if (isPrimitive(item)) {
    return item;
  }

  if (Array.isArray(item)) {
    return item.map(normalize);
  }

  if (isPlainObject(item)) {
    const nested: Attributes = {};

    for (const [key, entry] of Object.entries(item)) {
      encode(entry, [key], nested);
    }

    return nested;
  }

  return undefined;
};

/**
 * `DdRum` for the tests, modelled on `@datadog/mobile-react-native` 3.7.
 * `addError` flattens its attributes the way the SDK does, which drops every
 * object whose constructor is not `Object`. Before `initialize`, a call waits
 * in a bounded buffer and resolves at once; afterwards it settles when the
 * native call does. The error event mapper can discard an error without a
 * word, and the native SDK attaches the user set when the error is recorded.
 */
export const fakeDdRum = ({
  initialized = true,
}: { initialized?: boolean } = {}) => {
  const state: {
    initialized: boolean;
    user: Attributes | undefined;
    /** Makes the error event mapper discard every error. */
    discard: boolean;
    /** Makes the native call reject. */
    nativeFailure: Error | null;
  } = { initialized, user: undefined, discard: false, nativeFailure: null };

  const buffered: Array<() => Promise<void>> = [];
  const errors: RecordedError[] = [];
  const calls = { addError: 0 };

  const sdk = {
    addError(
      message: string,
      source: string,
      stacktrace: string,
      context: object = {},
      timestampMs: number = Date.now(),
    ) {
      calls.addError += 1;

      if (state.discard) {
        return Promise.resolve();
      }

      const attributes: Attributes = {
        "_dd.error.source_type": "react-native",
      };

      if (isPlainObject(context)) {
        for (const [key, entry] of Object.entries(context)) {
          encode(entry, [key], attributes);
        }
      }

      const record = () => {
        if (state.nativeFailure !== null) {
          return Promise.reject(state.nativeFailure);
        }

        errors.push({
          message,
          source,
          stacktrace,
          attributes,
          timestampMs,
          user: state.user,
        });

        return Promise.resolve();
      };

      if (!state.initialized) {
        if (buffered.length < 100) {
          buffered.push(record);
        }

        return Promise.resolve();
      }

      return record();
    },
  };

  return {
    sdk,
    state,
    errors,
    calls,
    /** What `DdSdkReactNative.initialize` does to the calls it buffered. */
    initialize: async () => {
      state.initialized = true;

      for (const record of buffered.splice(0)) {
        await record();
      }
    },
    /** What `DdSdkReactNative.setUserInfo` does. */
    setUserInfo: (user: Attributes) => {
      state.user = { ...user };
    },
  };
};
