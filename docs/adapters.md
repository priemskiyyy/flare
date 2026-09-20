---
description: "Compare the Flare adapters for Sentry, Bugsnag, Crashlytics, your own HTTP backend and the console, and see how to set each one up."
---

# Choose an adapter

An adapter translates one sanitized report for one provider. You can use several at once, and adding or removing one is a configuration change, not a change to your reporting code.

| Adapter     | Platforms                 | Per-report metadata      | Messages | Evidence                 | Flush |
| ----------- | ------------------------- | ------------------------ | -------- | ------------------------ | ----- |
| Sentry      | browser, React Native     | all of it                | yes      | `sdk-call-returned`      | yes   |
| Bugsnag     | browser, React Native     | all of it                | opt-in   | `sdk-callback-completed` | no    |
| Crashlytics | React Native              | none                     | no       | `sdk-call-returned`      | no    |
| HTTP        | anywhere with a `fetch`   | all of it, as JSON       | yes      | `backend-acknowledged`   | no    |
| Console     | anywhere with a `console` | all of it, on the report | yes      | `sdk-call-returned`      | no    |

The details behind each cell are in [provider limitations](provider-limitations.md).

## You own the SDK

Every provider adapter takes the SDK as an option and imports nothing from the provider. By default the SDK is **borrowed**: you initialize it, and Flare only reports through it. On `dispose()`, Flare removes what it wrote and leaves the SDK running.

Pass `ownership: "owned"` and Flare initializes the SDK when the destination opens. On `dispose()` it closes an SDK that can be closed. Sentry can. Bugsnag cannot be stopped once started, so there is nothing to release.

## Sentry

```ts
import { Flare } from "@priemskiyyy/flare";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

Sentry.init({ dsn });

const flare = new Flare({
  destinations: { sentry: sentry({ sdk: Sentry }) },
});
```

Each report is written to a forked scope that exists for that one call, so nothing reaches Sentry's global scope. The report id travels as the `flare.report_id` tag. For React Native, import from `@priemskiyyy/flare-sentry/react-native` and pass `@sentry/react-native`. See [React Native and Expo](react-native.md).

An owned setup:

```ts
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

const destination = sentry({
  sdk: Sentry,
  ownership: "owned",
  init: () => Sentry.init({ dsn }),
});
```

## Bugsnag

```ts
import Bugsnag, { Breadcrumb } from "@bugsnag/js";
import { Flare } from "@priemskiyyy/flare";
import { bugsnag } from "@priemskiyyy/flare-bugsnag";

Bugsnag.start({ apiKey });

const flare = new Flare({
  destinations: { bugsnag: bugsnag({ sdk: Bugsnag, Breadcrumb }) },
});
```

Each report is written onto its own event inside the `notify` callback. Pass Bugsnag's `Breadcrumb` class to have breadcrumbs attached to each event. Without it, and without the ambient breadcrumb mirror, breadcrumbs are listed as a loss.

Bugsnag has no message events. By default a `message()` is skipped as `unsupported-report-kind`. Pass `messages: "as-error"` to send it as an error named `Message`, with the loss recorded.

For React Native, import from `@priemskiyyy/flare-bugsnag/react-native`.

## Crashlytics

```ts
import { Flare } from "@priemskiyyy/flare";
import { crashlytics } from "@priemskiyyy/flare-crashlytics";
import * as firebaseCrashlytics from "@react-native-firebase/crashlytics";

const flare = new Flare({
  destinations: { crashlytics: crashlytics({ sdk: firebaseCrashlytics }) },
});
```

Pass the modular module namespace. Crashlytics records a non-fatal error and can attach nothing to a single report, so the adapter sends the error and lists everything else as a loss. Read [provider limitations](provider-limitations.md) before relying on it for metadata.

## Your own backend

```ts
import { Flare } from "@priemskiyyy/flare";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: { backend: http({ endpoint: "/api/error-reports" }) },
});
```

The only adapter whose evidence is a server's answer. See [the HTTP backend contract](http-backend.md).

## Console

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: consoleReporter() },
});
```

For development. It prints one line per report through `console.error`, `console.warn` or `console.info` by level, and passes the whole report as the second argument so you can expand it. Pass a `writer` to send the line somewhere else.

## Something else

An adapter is a small object. See [writing an adapter](writing-an-adapter.md).
