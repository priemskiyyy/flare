/**
 * The part of the modular React Native Firebase Crashlytics API the adapter
 * calls. The module namespace of `@react-native-firebase/crashlytics`
 * satisfies it, so the package does not import it: the application injects it.
 *
 * `recordError` takes an Error and nothing else. The user id and the custom
 * keys are global, take strings only, and cannot be removed once set.
 *
 * @example
 * ```ts
 * import * as Crashlytics from "@react-native-firebase/crashlytics";
 *
 * crashlytics({ sdk: Crashlytics });
 * ```
 */
export type CrashlyticsLike<TInstance = unknown> = {
  getCrashlytics: () => TInstance;
  recordError: (crashlytics: TInstance, error: Error) => void;
  log: (crashlytics: TInstance, message: string) => void;
  setAttributes: (
    crashlytics: TInstance,
    attributes: Record<string, string>,
  ) => PromiseLike<unknown>;
  setUserId: (crashlytics: TInstance, userId: string) => PromiseLike<unknown>;
};
