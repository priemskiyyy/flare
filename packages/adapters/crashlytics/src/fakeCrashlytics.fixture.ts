type Recorded = {
  error: Error;
  /** What the native SDK attaches on its own: whatever is global at that moment. */
  userId: string;
  attributes: Record<string, string>;
  logs: string[];
};

/**
 * The modular React Native Firebase Crashlytics API for the tests. It models
 * the one fact this reporter is built around: `recordError` takes an Error
 * and nothing else, and the native SDK attaches the global user id, keys and
 * logs to it by itself.
 */
export const fakeCrashlytics = () => {
  const instance = { name: "fake crashlytics instance" };

  const state: {
    userId: string;
    attributes: Record<string, string>;
    logs: string[];
    /** Makes the asynchronous setters reject, like a native module that fails. */
    rejectSetters: boolean;
    /** Makes `recordError` throw. */
    recordFailure: Error | null;
  } = {
    userId: "",
    attributes: {},
    logs: [],
    rejectSetters: false,
    recordFailure: null,
  };

  const recorded: Recorded[] = [];
  const calls = { getCrashlytics: 0, setAttributes: 0, setUserId: 0 };

  const answer = () =>
    state.rejectSetters
      ? Promise.reject(new Error("native module failed"))
      : Promise.resolve(null);

  const sdk = {
    getCrashlytics: () => {
      calls.getCrashlytics += 1;

      return instance;
    },
    recordError: (_crashlytics: typeof instance, error: Error) => {
      if (state.recordFailure !== null) {
        throw state.recordFailure;
      }

      recorded.push({
        error,
        userId: state.userId,
        attributes: { ...state.attributes },
        logs: [...state.logs],
      });
    },
    log: (_crashlytics: typeof instance, message: string) => {
      state.logs.push(message);
    },
    setAttributes: (
      _crashlytics: typeof instance,
      attributes: Record<string, string>,
    ) => {
      calls.setAttributes += 1;
      Object.assign(state.attributes, attributes);

      return answer();
    },
    setUserId: (_crashlytics: typeof instance, userId: string) => {
      calls.setUserId += 1;
      state.userId = userId;

      return answer();
    },
  };

  return { sdk, instance, state, recorded, calls };
};
