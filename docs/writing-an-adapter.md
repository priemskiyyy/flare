---
description: "Write a Flare adapter for another error reporting provider: the session contract, results and losses, ambient state, and the conformance suite."
---

# Writing an adapter

An adapter translates one sanitized report for one provider. It owns no policy. Routing, redaction, buffering, deadlines, dedupe and account boundaries are done before it is called, and it never sees the thrown value.

## The smallest adapter

```ts
import type { ReporterAdapter } from "@priemskiyyy/flare";

type Beacon = { send: (body: string) => boolean };

export const beacon = ({ sdk }: { sdk: Beacon }): ReporterAdapter<Beacon> => ({
  name: "beacon",
  open: () => ({
    native: sdk,
    submit: (report) => {
      if (!sdk.send(JSON.stringify(report))) {
        return {
          status: "failed",
          error: new Error("The beacon was refused."),
        };
      }

      return { status: "submitted", evidence: "sdk-call-returned" };
    },
  }),
});
```

An adapter is a name and an `open` function. `open` runs when the Flare starts and returns the session: the provider handle as `native`, `submit`, and when the provider needs them, `flush`, `ambient` and `dispose`. The runtime owns the lifecycle around the session. It opens each destination once, calls `dispose` once when there is one, and calls nothing on a session after that.

## The rules

**The factory is cold.** Creating the adapter does nothing. It may be created at module scope on a server. All work starts in `open`.

**Take the SDK the application set up.** Do not import the provider, and never initialize or close it. Describe the part of the SDK you call as a structural type, and add a typecheck-only contract file that assigns the real SDK to it, so an SDK upgrade that breaks the shape fails your build.

**`open` succeeds, or throws before it changes anything.** Check the SDK first, and throw a `FlareError` whose code is `NOT_INITIALIZED` when it is not set up, or `UNSUPPORTED` when it lacks what you need. The reports captured meanwhile wait in the startup buffer until `flare.start()` is called again. Undo in `dispose` whatever the session set up.

```ts
import { FlareError } from "@priemskiyyy/flare";
import type { ReporterAdapter } from "@priemskiyyy/flare";

type Sdk = {
  isReady: () => boolean;
  onError: (listener: () => void) => () => void;
  report: (body: string) => void;
};

export const example = ({ sdk }: { sdk: Sdk }): ReporterAdapter<Sdk> => ({
  name: "example",
  open: () => {
    if (!sdk.isReady()) {
      throw new FlareError({
        code: "NOT_INITIALIZED",
        message: "Example is not set up. Call setup before flare.start().",
      });
    }

    const stop = sdk.onError(() => {});

    return {
      native: sdk,
      submit: (report) => {
        sdk.report(JSON.stringify(report));

        return { status: "submitted", evidence: "sdk-call-returned" };
      },
      dispose: stop,
    };
  },
});
```

**Hand an SDK the sanitized error.** An SDK that takes only an `Error` gets `new SanitizedError(report.exception)`: the sanitized name, message and stack, with the cause chain. It is the only `Error` an adapter can build, and it carries nothing the core did not redact and bound first.

```ts
import { SanitizedError } from "@priemskiyyy/flare";
import type { ReporterAdapter } from "@priemskiyyy/flare";

type Tracker = { captureException: (error: Error) => void };

export const tracker = ({
  sdk,
}: {
  sdk: Tracker;
}): ReporterAdapter<Tracker> => ({
  name: "tracker",
  open: () => ({
    native: sdk,
    submit: (report) => {
      if (report.kind === "message") {
        return { status: "skipped", reason: "unsupported-report-kind" };
      }

      sdk.captureException(new SanitizedError(report.exception));

      return { status: "submitted", evidence: "sdk-call-returned" };
    },
  }),
});
```

**Never write a report to global state.** If the SDK can attach data to one event, through a forked scope or a per-event callback, use that. If it cannot, list that part as a loss. Setting a global and unsetting it around the call is how one report's data lands on another, and it is the one thing an adapter must never do.

**Say what the provider cannot carry.** A submitted result lists what the provider could not express as `losses`. A provider that cannot take a kind of report at all, such as a message, answers `skipped` with `unsupported-report-kind` rather than sending it as something it is not.

**Return a result, do not throw.** A thrown error is contained and becomes a `failed` outcome, but a returned result says more. When the SDK swallows its own error and leaves you nothing to return, answer `failed` with a `FlareError` whose code is `SUBMISSION_FAILED`.

A submitted result needs only `status` and `evidence`. Return `event: { id }` when the provider supplies an event id. Omit `event` when it supplies none and `losses` when nothing was lost; the receipt contains `event: null` and `losses: []` in those cases. The core copies and freezes the fields each status allows, and publishes nothing else an answer carries.

| Result          | When                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `submitted`     | The SDK took it. State the evidence, and list what could not be represented.  |
| `skipped`       | This adapter cannot take this report, such as a message it has no notion of.  |
| `dropped`       | With `provider-filtered`, when the SDK tells you its own filter discarded it. |
| `failed`        | The attempt failed.                                                           |
| `indeterminate` | With `ambiguous`, when you cannot tell whether it went out.                   |

An answer the contract does not allow is a failure with a `FlareError` whose code is `INVALID_ANSWER`: an `open` without a `submit` function fails the start, a result with an unknown status fails the outcome, and a flush that answers anything but `flushed`, `timeout` or `failed` fails the flush.

**Respect the signal.** `submit` receives an `AbortSignal` that fires at the deadline and on disposal. Pass it to whatever can be cancelled. `flush` receives what is left of the caller's timeout, and a signal that fires when it passes.

**Check the account when you await.** If `submit` awaits anything that depends on who is signed in, such as a token, compare `context.currentGeneration()` with `report.identity.generation` afterwards, and return `skipped` with `auth-subject-mismatch` when they differ.

## Ambient state

An SDK that captures crashes by itself only knows what is in its global state. An adapter may offer to mirror the session there, by returning an `ambient` member from `open`. Its `session` callback is called when the destination opens and whenever the user, tags or contexts change, and its `breadcrumb` callback for every breadcrumb.

- It is opt-in, per part, and off by default.
- It receives session data only, which is already sanitized. It never receives a report.
- It clears what it wrote when the value is removed, when the account changes, and on disposal, and it clears nothing it did not write. When the provider cannot remove something, such as a breadcrumb, the README says so.
- When you then write a report to an event, first clear from that event whatever your mirror put there for a different account. A report that waited in the buffer across a sign-in must not pick up the new account's tags.

## Test it

Keep a fake of the SDK beside the adapter, and register the shared contract in `src/conformance.test.ts`:

```ts
import { console } from "@priemskiyyy/flare-console";
import { testReporterAdapter } from "@priemskiyyy/flare/testing";

testReporterAdapter({
  name: "console",
  createAdapter: () => console({ writer: () => {} }),
});
```

The suite checks what is provider independent: a named description, a stable native handle, an untouched report, reports answered without failing and messages sent or honestly skipped, a flush and an ambient integration that answer, disposal that completes, and an independent session per `open`. It cannot check how you map each field or that the factory is cold. Those belong in your own tests, along with one that proves two concurrent reports for different accounts never share state.
