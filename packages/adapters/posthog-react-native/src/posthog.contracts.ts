// Typechecked, never imported: these assignments fail compilation if the real
// posthog-react-native client stops satisfying the structural type the
// adapter is written against, or if the injected client stops flowing into
// the native handle.
import { Flare } from "@priemskiyyy/flare";
import posthogJs from "posthog-js";
import type { PostHog } from "posthog-react-native";

import { posthog } from "src/posthog";
import type { PostHogLike } from "src/types/PostHogLike";

declare const client: PostHog;

export const sdk: PostHogLike = client;

export const flare = new Flare({
  destinations: { posthog: posthog({ sdk: client }) },
});

// The native handle is the real client, with everything Flare does not wrap.
export const reset = flare.destination("posthog").native?.reset;

// @ts-expect-error -- posthog-js has its own package.
posthog({ sdk: posthogJs });
