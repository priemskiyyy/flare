# @priemskiyyy/flare-posthog-react-native

Send [Flare](../../core) exceptions to PostHog error tracking on React Native. You pass in the posthog-react-native client your application created, so this package imports no SDK. In the browser, use [`@priemskiyyy/flare-posthog`](../posthog).

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-posthog-react-native posthog-react-native
```

## Create a Flare

```ts
import { Flare } from "@priemskiyyy/flare";
import { posthog } from "@priemskiyyy/flare-posthog-react-native";
import PostHog from "posthog-react-native";

const client = new PostHog("phc_project_api_key");

const flare = new Flare({
  destinations: { posthog: posthog({ sdk: client }) },
});

flare.start();
client.identify("user_42");
flare.user({ id: "user_42" });
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

## Options

| Option | Default  | Meaning                              |
| ------ | -------- | ------------------------------------ |
| `sdk`  | required | The client your application created. |

There is no ambient option. See [below](#no-ambient-integration).

## Who a report belongs to

PostHog files every event under the person the client identifies when the event is captured. A report without a user is sent under whoever that is. A report with a user is sent only when the client's distinct id is that user's `id`, and is otherwise skipped as `identity-mismatch`. The adapter first waits until the client has loaded its storage, and with it the persisted distinct id. A report whose deadline passes during that wait is not sent.

Give Flare and PostHog the same id: `client.identify(user.id)` and `flare.user({ id: user.id })`. The adapter never calls `identify` or `reset`.

## How a report is mapped

Each exception is one `captureException` call, mapped as [`@priemskiyyy/flare-posthog`](../posthog#how-a-report-is-mapped) maps it: tags and contexts become event properties, breadcrumbs become the event's exception steps, and `flare.report_id`, `flare.operation` and `flare.aggregated` carry what PostHog has no field for. The same names are reserved and listed as losses. A message is skipped as `unsupported-report-kind`, because PostHog tracks exceptions.

## Behavior

- Versions: `posthog-react-native` 4.75 or later within 4.x, an optional peer dependency, typed structurally through `PostHogLike`.
- Initialization is yours. Flare never creates the client, identifies anyone or resets anything.
- Evidence is `sdk-call-returned`, and there is no event id. `captureException` answers nothing: a disabled or opted-out client and `before_send` drop an event without saying so.
- Queue and offline: the client keeps its queue in the storage it finds on the device, such as AsyncStorage or expo-file-system, so events are sent later, even after a restart. With `persistence: "memory"`, or with no storage, they live in memory only.
- Flush: `flare.flush()` sends the client's queue and settles once PostHog answered for it. A refused batch is a `failed` flush. Flare bounds the wait.
- Automatic capture is PostHog's own. Exceptions PostHog autocaptures never pass through Flare. Give each source one owner.
- `native` is the client, fully typed, for everything Flare does not wrap, such as `identify` and feature flags. Calls made on it bypass Flare's routing, receipts and privacy.

## No ambient integration

The user is PostHog's person, which your application sets with `identify` and `reset`. Super properties would travel on every analytics event, not only on errors. And exception steps cannot be taken back, so a mirror could not clear them when the account changes.

## Tests

Mapping and lifecycle tests use an in-process fake modelled on `posthog-react-native` 4.75 and `@posthog/core`, including a client that waits for its storage and attaches buffered steps only when none are passed. A typecheck-only contract assigns the real client to its structural type. The client never ran, on a device or anywhere else: delivery, storage and the native layer are not covered, and no event was sent to PostHog.

## License

[MIT](LICENSE)
