---
description: "Compare the Flare adapters for Sentry, Bugsnag, Crashlytics, PostHog, Datadog, OpenTelemetry, your own HTTP backend and the console, and see how to set each one up."
---

# Choose an adapter

An adapter translates one sanitized report for one provider. You can use several at once, and adding or removing one is a configuration change, not a change to your reporting code.

| Adapter              | Platforms                 | Per-report metadata         | Messages | Evidence                 | Flush             |
| -------------------- | ------------------------- | --------------------------- | -------- | ------------------------ | ----------------- |
| Sentry               | browser, React Native     | all of it                   | yes      | `sdk-call-returned`      | yes               |
| Bugsnag              | browser, React Native     | all of it                   | opt-in   | `sdk-callback-completed` | no                |
| Crashlytics          | React Native              | none                        | no       | `sdk-call-returned`      | no                |
| PostHog              | browser                   | all of it, but the user     | no       | `sdk-call-returned`      | no                |
| PostHog React Native | React Native              | all of it, but the user     | no       | `sdk-call-returned`      | yes               |
| Datadog              | browser                   | all of it, but the user     | no       | `sdk-call-returned`      | no                |
| Datadog React Native | React Native              | all of it, but the user     | no       | `sdk-call-returned`      | no                |
| Datadog Logs         | browser                   | all of it, but the user     | yes      | `sdk-call-returned`      | no                |
| OpenTelemetry        | anywhere with a logger    | all of it                   | yes      | `sdk-call-returned`      | with `forceFlush` |
| HTTP                 | anywhere                  | all of it, the whole report | yes      | `backend-acknowledged`   | no                |
| Console              | anywhere with a `console` | all of it, on the report    | yes      | `sdk-call-returned`      | no                |

Each adapter is its own package, `@priemskiyyy/flare-` followed by `sentry`, `bugsnag`, `crashlytics`, `posthog`, `posthog-react-native`, `datadog`, `datadog-react-native`, `datadog-logs`, `opentelemetry`, `http` or `console`. The details behind each cell are in [provider limitations](provider-limitations.md).

## You own the SDK

Every provider adapter takes the SDK your application already set up and imports nothing from the provider. You initialize it, and Flare only reports through it. It never initializes or closes the SDK: on `dispose()`, Flare takes back the user, tags and contexts its ambient mirror wrote, and leaves the SDK running. Where a provider's browser and React Native SDKs share an API, as Sentry's and Bugsnag's do, one package takes either. Where they differ, as PostHog's and Datadog's do, React Native has its own package, with a factory of the same name.

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

Each report is written to a forked scope that exists for that one call, so nothing reaches Sentry's global scope. The report id travels as the `flare.report_id` tag. On React Native, pass `@sentry/react-native` instead. See [React Native and Expo](react-native.md).

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

Each report is written onto its own event inside the `notify` callback. Bugsnag's `Breadcrumb` class, a named export of the same package, is how a report's breadcrumbs are attached to its own event.

Bugsnag has no message events. By default a `message()` is skipped as `unsupported-report-kind`. Pass `messages: "as-error"` to send it as an error named `Message`, with the loss recorded.

On React Native, import `Bugsnag` and `Breadcrumb` from `@bugsnag/react-native` instead.

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

## PostHog

```ts
import { Flare } from "@priemskiyyy/flare";
import { posthog } from "@priemskiyyy/flare-posthog";
import posthogJs from "posthog-js";

posthogJs.init("phc_project_api_key");

const flare = new Flare({
  destinations: { posthog: posthog({ sdk: posthogJs }) },
});
```

Each report is one `$exception` event whose properties are its own, and its breadcrumbs become the event's exception steps. PostHog files every event under the person it identifies, so a report is sent only while that person is the report's user: give `posthog.identify` and `flare.user` the same id. Messages are skipped.

On React Native, use `@priemskiyyy/flare-posthog-react-native` with the client you created. It maps each report the same way, waits until the client has loaded its storage before it compares the report's user with the distinct id, and its flush sends the client's queue:

```ts
import { Flare } from "@priemskiyyy/flare";
import { posthog } from "@priemskiyyy/flare-posthog-react-native";
import PostHog from "posthog-react-native";

const client = new PostHog("phc_project_api_key");

const flare = new Flare({
  destinations: { posthog: posthog({ sdk: client }) },
});
```

## Datadog

```ts
import { datadogRum } from "@datadog/browser-rum";
import { Flare } from "@priemskiyyy/flare";
import { datadog } from "@priemskiyyy/flare-datadog";

datadogRum.init({ applicationId: "app-id", clientToken: "pub-token" });

const flare = new Flare({
  destinations: { datadog: datadog({ sdk: datadogRum }) },
});
```

Each report is one RUM error, and everything it carries beyond the error travels under the `flare` attribute of that error's context, where Datadog's global context cannot overwrite it. RUM attaches its current user to every event, so a report is sent only while that user is the report's own. RUM has no messages and no levels: messages are skipped, and the level travels as `flare.level`.

On React Native, use `@priemskiyyy/flare-datadog-react-native` with `DdRum`. It records each error at the time it was captured. Its SDK does not reveal its user, so the adapter skips a report whose account changed since it was captured, and lists the user as a loss on every other report that has one:

```ts
import { DdRum } from "@datadog/mobile-react-native";
import { Flare } from "@priemskiyyy/flare";
import { datadog } from "@priemskiyyy/flare-datadog-react-native";

const flare = new Flare({
  destinations: { datadog: datadog({ sdk: DdRum }) },
});
```

## Datadog Logs

```ts
import { datadogLogs as browserLogs } from "@datadog/browser-logs";
import { Flare } from "@priemskiyyy/flare";
import { datadogLogs } from "@priemskiyyy/flare-datadog-logs";

browserLogs.init({ clientToken: "pub-token" });

const flare = new Flare({
  destinations: { logs: datadogLogs({ sdk: browserLogs }) },
});
```

Each report, messages included, is one log with its own status and error, and everything else travels under the `flare` attribute. Like RUM, Datadog attaches its current user to every log, so a report is sent only while that user is the report's own. Use it beside `@priemskiyyy/flare-datadog` to see exceptions in error tracking as well.

## OpenTelemetry

```ts
import { logs } from "@opentelemetry/api-logs";
import { Flare } from "@priemskiyyy/flare";
import { opentelemetry } from "@priemskiyyy/flare-opentelemetry";

const flare = new Flare({
  destinations: { otel: opentelemetry({ logger: logs.getLogger("app") }) },
});
```

Each report is one log record with its own severity, user, exception and attributes, sent through your provider's exporter to any OTLP backend. A record carries everything itself, so nothing global is written and nothing is lost. Pass the provider's `forceFlush` too, and `flare.flush()` waits for the export.

## Your own backend

```ts
import { Flare } from "@priemskiyyy/flare";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: { backend: http({ request: sendReport }) },
});
```

`sendReport` is your own client call: it sends one report and resolves once your backend accepted it. It is the only adapter whose evidence is your backend's answer. See [the HTTP backend contract](http-backend.md) for a reference implementation over `fetch`.

## Console

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: console() },
});
```

For development. It prints one line per report through `console.error`, `console.warn` or `console.info` by level, and passes the whole report as the second argument so you can expand it. Pass a `writer` to send the line somewhere else.

## Something else

An adapter is a small object. See [writing an adapter](writing-an-adapter.md).
