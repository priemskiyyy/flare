// Typechecked, never imported: these assignments fail compilation if a real
// Sentry SDK stops satisfying the structural type the adapter is written
// against, or if the injected SDK stops flowing into the native handle.
import { Flare } from "@priemskiyyy/flare";
import * as SentryBrowser from "@sentry/browser";
import * as SentryReactNative from "@sentry/react-native";

import { sentry } from "src/sentry";
import type { SentryLike } from "src/types/SentryLike";

export const browserSdk: SentryLike = SentryBrowser;
export const reactNativeSdk: SentryLike = SentryReactNative;

export const flare = new Flare({
  destinations: {
    web: sentry({ sdk: SentryBrowser }),
    native: sentry({ sdk: SentryReactNative, ambient: { user: true } }),
  },
});

// The native handle is the real SDK, with everything Flare does not wrap.
export const replay = flare.destination("web").native?.getReplay;
export const nativeCrash = flare.destination("native").native?.nativeCrash;

// @ts-expect-error -- an object that is not a Sentry SDK is refused.
sentry({ sdk: { captureException: () => "id" } });
