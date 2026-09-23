// Typechecked, never imported: these assignments fail compilation if the real
// posthog-js stops satisfying the structural type the adapter is written
// against, or if the injected SDK stops flowing into the native handle.
import { Flare } from "@priemskiyyy/flare";
import posthogJs from "posthog-js";
import type { PostHog as PostHogReactNative } from "posthog-react-native";

import { posthog } from "src/posthog";
import type { PostHogLike } from "src/types/PostHogLike";

declare const client: PostHogReactNative;

export const sdk: PostHogLike = posthogJs;

export const flare = new Flare({
  destinations: { posthog: posthog({ sdk: posthogJs }) },
});

// The native handle is the real SDK, with everything Flare does not wrap.
export const identify = flare.destination("posthog").native?.identify;

// @ts-expect-error -- an object that is not posthog-js is refused.
posthog({ sdk: { captureException: () => undefined } });

// @ts-expect-error -- the React Native client has its own package.
posthog({ sdk: client });
