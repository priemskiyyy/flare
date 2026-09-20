---
description: "Set up Flare in React Native and Expo with the React Native builds of the Sentry and Bugsnag adapters, Crashlytics, and a flush when the app goes to the background."
---

# React Native and Expo

The core, the React bindings, the HTTP adapter and the console adapter are the same packages on every platform. Sentry and Bugsnag have a React Native entry, and Crashlytics is React Native only.

```ts
import { Flare } from "@priemskiyyy/flare";
import { sentry } from "@priemskiyyy/flare-sentry/react-native";
import * as Sentry from "@sentry/react-native";

Sentry.init({ dsn });

export const flare = new Flare({
  destinations: { sentry: sentry({ sdk: Sentry }) },
});

flare.start();
```

The React Native entry differs from the browser one in what it declares, not in how it maps a report: events are persisted by the native SDK, and a flush is a handoff to it. Both entries accept either SDK, so TypeScript will not catch a mix-up. Use the entry that matches your SDK, or the capabilities shown on receipts and in the devtools will be wrong.

## Who owns native crashes

The provider's native SDK does, entirely. A native crash ends the JavaScript runtime, so no JavaScript library can report it. The native SDK writes it to disk and sends it on the next launch. Flare reports the JavaScript errors you catch, and the [ambient mirror](automatic-capture.md) is how a native crash gets the same user, tags and breadcrumbs.

Flare does not replace `ErrorUtils.setGlobalHandler`. Your provider SDK already did.

## Flush in the background

An app that goes to the background may be suspended at any time:

```ts
import { AppState } from "react-native";

const subscription = AppState.addEventListener("change", (state) => {
  if (state === "background") {
    flare.flush({ timeoutMs: 1500 });
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
