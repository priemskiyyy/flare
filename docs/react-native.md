---
description: "Set up Flare in React Native and Expo with the React Native SDKs of Sentry, Bugsnag, PostHog and Datadog, with Crashlytics, and with a flush when the app goes to the background."
---

# React Native and Expo

The core, the React bindings, the HTTP adapter and the console adapter are the same packages on every platform. The Sentry and Bugsnag adapters take their React Native SDK through the same factory as the browser one. PostHog and Datadog have a React Native SDK with its own API, so each has its own React Native package: `@priemskiyyy/flare-posthog-react-native` and `@priemskiyyy/flare-datadog-react-native`. Crashlytics is React Native only.

```ts
import { Flare } from "@priemskiyyy/flare";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/react-native";

Sentry.init({ dsn });

export const flare = new Flare({
  destinations: { sentry: sentry({ sdk: Sentry }) },
});

flare.start();
```

The adapter is the same one the browser uses: a report is mapped the same way whichever SDK you pass. What differs is the SDK itself. On React Native it persists events on the device and sends them later, and `flare.flush()` hands events to the native layer rather than waiting for them to be sent.

PostHog and Datadog use their React Native packages instead, with the client or module your application set up:

```sh
pnpm add @priemskiyyy/flare-posthog-react-native posthog-react-native
pnpm add @priemskiyyy/flare-datadog-react-native @datadog/mobile-react-native
```

```ts
import { DdRum } from "@datadog/mobile-react-native";
import { Flare } from "@priemskiyyy/flare";
import { datadog } from "@priemskiyyy/flare-datadog-react-native";
import { posthog } from "@priemskiyyy/flare-posthog-react-native";
import PostHog from "posthog-react-native";

const client = new PostHog("phc_project_api_key");

export const flare = new Flare({
  destinations: {
    posthog: posthog({ sdk: client }),
    datadog: datadog({ sdk: DdRum }),
  },
});
```

## Who owns native crashes

The provider's native SDK does, entirely. A native crash ends the JavaScript runtime, so no JavaScript library can report it. The native SDK writes it to disk and sends it on the next launch. Flare reports the JavaScript errors you catch. With Sentry, Bugsnag and Crashlytics, the [ambient mirror](automatic-capture.md) is how a native crash gets the same user, tags and breadcrumbs. Datadog and PostHog have no mirror: what their SDKs capture by themselves carries the user your application set with `DdSdkReactNative.setUserInfo` or `identify`.

Flare does not replace `ErrorUtils.setGlobalHandler`. Your provider SDK already did.

## Flush in the background

An app that goes to the background may be suspended at any time. Sentry hands its events to the native SDK, and PostHog sends the client's queue; the other adapters have no flush of their own, so `flare.flush()` only waits for their submissions:

```ts
import { AppState } from "react-native";

const subscription = AppState.addEventListener("change", (state) => {
  if (state === "background") {
    flare.flush({ timeout: 1500 });
  }
});
```

## Hermes

Hermes has no `crypto.randomUUID`, so report ids fall back to `Math.random`. An id is an idempotency key, not a secret, so this is safe.

## Expo

The Flare packages are plain JavaScript and need no config plugin and no native module. Your provider SDK does. Follow its own Expo instructions for the config plugin, source maps and whether it needs a development build instead of Expo Go.

## Error boundaries

`FlareErrorBoundary` works the same in React Native. In development, the LogBox covers a working fallback, so check a boundary's fallback in a release build.

## What has been verified

Every adapter is tested against a fake that is typechecked against the real SDK's declarations. None has been run on a device in this repository. See [the verification matrix](verification.md).
