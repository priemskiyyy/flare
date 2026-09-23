# @priemskiyyy/flare-posthog

Send [Flare](../../core) exceptions to PostHog error tracking in the browser. You pass in the posthog-js instance your application already initialized, so this package imports no SDK. On React Native, use [`@priemskiyyy/flare-posthog-react-native`](../posthog-react-native).

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-posthog posthog-js
```

## Create a Flare

```ts
import { Flare } from "@priemskiyyy/flare";
import { posthog } from "@priemskiyyy/flare-posthog";
import posthogJs from "posthog-js";

posthogJs.init("phc_project_api_key", { api_host: "https://eu.i.posthog.com" });

const flare = new Flare({
  destinations: { posthog: posthog({ sdk: posthogJs }) },
});

flare.start();
posthogJs.identify("user_42");
flare.user({ id: "user_42" });
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

## Options

| Option | Default  | Meaning                                               |
| ------ | -------- | ----------------------------------------------------- |
| `sdk`  | required | The posthog-js instance your application initialized. |

There is no ambient option. See [below](#no-ambient-integration).

## Who a report belongs to

PostHog files every event under the person it identifies when the event is captured: the distinct id that `identify` and `reset` leave behind. It has no way to file one event under someone else without moving it to another person. So a report is sent only while that person is the report's own:

- A report without a user is sent, and PostHog files it under whoever it identifies, the anonymous person included.
- A report with a user is sent only when PostHog's distinct id is that user's `id`. Otherwise it is skipped as `identity-mismatch`: a report captured before an account switch, or captured on behalf of another user, never lands on the wrong person.

Give Flare and PostHog the same id: `posthog.identify(user.id)` and `flare.user({ id: user.id })`. The adapter never calls `identify` or `reset`, and never writes the report's email or name: those are the person's properties, and they are yours to set.

## How a report is mapped

Each report is one `captureException` call. Its properties are the report's own, and PostHog merges them over its super properties on that event only.

| Flare             | PostHog                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| exception         | `captureException` with an `Error` rebuilt from the sanitized name, message and stack                             |
| cause chain       | `cause` on the rebuilt errors, which PostHog follows into `$exception_list`                                       |
| aggregated errors | the property `flare.aggregated`, with each error's name and message: PostHog records one exception and its causes |
| message           | skipped as `unsupported-report-kind`, because PostHog tracks exceptions                                           |
| `level`           | `$exception_level`, with the same four names                                                                      |
| `identity.user`   | the person PostHog identifies, as described above                                                                 |
| `tags`            | one event property per tag                                                                                        |
| `contexts`        | one event property per context, holding the context's fields                                                      |
| `breadcrumbs`     | `$exception_steps`, each with the name as `$message`, the time as an ISO `$timestamp`, and the data as its fields |
| `operation`       | the property `flare.operation`                                                                                    |
| report id         | the property `flare.report_id`, so the same report can be found in every destination                              |

The steps are written even when a report has none. Without them PostHog would attach the steps it buffered through `addExceptionStep` for whoever is using the application now, and after an account switch those describe someone else. A step Flare writes is never taken from that buffer, and PostHog clears the buffer after each captured exception, Flare's included.

Losses, each `unsupported`:

- A tag or context whose name PostHog gives meaning to is not written: every name that starts with `$`, such as `$set`, which would change the person, and `distinct_id`, which would move the event to another person. So are `token`, which PostHog overwrites, `__proto__`, which does not survive PostHog's merge, and the three `flare.` names above that the adapter owns.
- A context that shares its name with a tag: the tag takes the property.
- Breadcrumb data named `$message` or `$timestamp`, which the step's own fields replace.

## Behavior

- Versions: `posthog-js` 1.434 or later within 1.x, an optional peer dependency, typed structurally through `PostHogLike`.
- Initialization is yours. Flare never initializes PostHog, identifies anyone or resets anything. An instance that `posthog.init` has not run on fails the destination's start with a `FlareError` whose code is `NOT_INITIALIZED`, and a slim bundle initialized without error tracking fails it with `UNSUPPORTED`. Call `flare.start()` again after `init` and it succeeds, and the reports captured meanwhile are delivered while they are still in Flare's buffer.
- Evidence is `sdk-call-returned`. `captureException` answers the event after `before_send` ran, so an event PostHog's own filters drop, through opt-out, bot detection, rate limits, suppression rules or `before_send`, is `dropped` with the reason `provider-filtered`, and a submitted one carries PostHog's event uuid as its `event.id`. The event then waits in PostHog's queue for its batch, so `submitted` does not mean PostHog stored it.
- Automatic capture is PostHog's own. Exceptions PostHog autocaptures never pass through Flare, so they carry only PostHog's own state. To avoid reporting one error twice, give each source one owner.
- Privacy: what Flare submits was redacted, scrubbed and bounded by the core. What PostHog adds on its own, such as the page URL, device and session properties and your super properties, is outside that guarantee. Harden it with PostHog's own options, such as `property_denylist` and `before_send`.
- Queue and offline: posthog-js keeps its queue in memory and retries failed requests with a backoff. Once a report is handed over, delivery belongs to PostHog.
- Flush: there is none, and `flare.flush()` reports `unsupported`: posthog-js sends its batches on its own schedule.
- PostHog is one instance per application. Register it under one destination name: two destinations over the same instance report every exception twice.
- `native` is the instance you passed in, fully typed, for everything Flare does not wrap, such as `identify` and feature flags. Calls made on it bypass Flare's routing, receipts and privacy.

## No ambient integration

Other adapters can mirror Flare's session into their provider's global state. This one cannot do so honestly. The user is PostHog's person, which your application sets with `identify` and `reset`. Super properties would travel on every analytics event, not only on errors. And exception steps cannot be taken back, so a mirror could not clear them when the account changes.

## Tests

Mapping and lifecycle tests use an in-process fake, modelled on the source of `posthog-js` 1.434, including its quirks: properties merged over the distinct id and the super properties, and buffered steps attached only when none are passed. An integration test runs the installed `posthog-js` in jsdom, with `fetch` stubbed, and reads each event through `before_send`. A typecheck-only contract assigns the real SDK to its structural type. No event is sent to PostHog.

## License

[MIT](LICENSE)
