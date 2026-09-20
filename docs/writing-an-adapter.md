---
description: "Write a Flare adapter for another error reporting provider: the session contract, honest capabilities, results and losses, ambient state, and the conformance suite."
---

# Writing an adapter

An adapter translates one sanitized report for one provider. It owns no policy. Routing, redaction, buffering, deadlines, dedupe and account boundaries are done before it is called, and it never sees the thrown value.

## The smallest adapter

```ts
import { createReporterAdapter } from "@priemskiyyy/flare";

type Beacon = { send: (body: string) => boolean };

export const beaconReporter = ({ sdk }: { sdk: Beacon }) =>
  createReporterAdapter<Beacon>({
    name: "beacon",
    capabilities: {
      eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
      messages: true,
      evidence: "sdk-call-returned",
      flush: "none",
      queue: "none",
      automaticCapture: "none",
      instance: "instance",
      filtering: "none",
    },
    open: () => ({
      native: sdk,
      submit: (report) => {
        if (!sdk.send(JSON.stringify(report))) {
          return {
            status: "failed",
            error: new Error("The beacon was refused."),
          };
        }
        return {
          status: "submitted",
          evidence: "sdk-call-returned",
        };
      },
    }),
  });
```

Omit `dispose` when the session owns nothing beyond its registered cleanups. The opened session always has an idempotent `dispose`.

`createReporterAdapter` supplies what every adapter needs and is easy to get wrong: an idempotent `dispose`, refusing `submit` and `flush` after disposal, silencing the ambient integration after disposal, and running cleanups when `open` fails halfway.

## The rules

**The factory is cold.** Creating the adapter does nothing. It may be created at module scope on a server. All work starts in `open`.

**Take the SDK as an option.** Do not import the provider. Describe the part of the SDK you call as a structural type, and add a typecheck-only contract file that assigns the real SDK to it, so an SDK upgrade that breaks the shape fails your build.

**`available` is optional and answers without side effects.** Omitting it means available. Return `{ available: false, reason }` when the environment cannot support the provider. The reason is shown to the developer.

**`open` registers what it must undo.** It receives a lifetime. Add a cleanup for everything you set up, as you set it up. If `open` then throws, what was added is rolled back.

```ts
import { createReporterAdapter } from "@priemskiyyy/flare";
import type { ReporterCapabilities } from "@priemskiyyy/flare";

type Sdk = {
  start: () => void;
  stop: () => void;
  report: (body: string) => void;
};

declare const capabilities: ReporterCapabilities;

export const example = ({ sdk }: { sdk: Sdk }) =>
  createReporterAdapter<Sdk>({
    name: "example",
    capabilities,
    open: (_context, lifetime) => {
      sdk.start();
      lifetime.add(() => sdk.stop());

      return {
        native: sdk,
        submit: (report) => {
          sdk.report(JSON.stringify(report));
          return {
            status: "submitted",
            evidence: "sdk-call-returned",
          };
        },
      };
    },
  });
```

**Never write a report to global state.** If the SDK can attach data to one event, through a forked scope or a per-event callback, use that. If it cannot, set `eventLocal` to `false` for that part and list it as a loss. Setting a global and unsetting it around the call is how one report's data lands on another, and it is the one thing an adapter must never do.

**Declare the truth.** Capabilities are shown to developers and checked by the conformance suite. `evidence` is the strongest claim a result may make. `messages: false` means you return `skipped` with `unsupported-report-kind` for a message.

**Return a result, do not throw.** A thrown error is contained and becomes a `failed` outcome, but a returned result says more:

A submitted result needs only `status` and `evidence`. Return `event: { id }` when the provider supplies an event id. Omit `event` when it supplies none and `losses` when nothing was lost; the receipt contains `event: null` and `losses: []` in those cases. The core copies and freezes the event reference before publishing it.

| Result          | When                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `submitted`     | The SDK took it. State the evidence, and list what could not be represented.  |
| `skipped`       | This adapter cannot take this report, such as a message it has no notion of.  |
| `dropped`       | With `provider-filtered`, when the SDK tells you its own filter discarded it. |
| `failed`        | The attempt failed.                                                           |
| `indeterminate` | With `ambiguous`, when you cannot tell whether it went out.                   |

**Respect the signal.** `submit` receives an `AbortSignal` that fires at the deadline and on disposal. Pass it to whatever can be cancelled.

**Check the account when you await.** If `submit` awaits anything that depends on who is signed in, such as a token, compare `context.currentGeneration()` with `report.identity.generation` afterwards, and return `skipped` with `auth-subject-mismatch` when they differ.

**Set `singleton` for a process-wide SDK.** Pass the SDK object itself. Flare then refuses two destinations over the same SDK, which would report every event twice.

## Ambient state

An SDK that captures crashes by itself only knows what is in its global state. An adapter may offer to mirror the session there, by returning an `ambient` member from `open`:

- It is opt-in, per part, and off by default.
- It receives session data only, which is already sanitized. It never receives a report.
- It clears what it wrote when the value is removed, when the account changes, and on disposal, and it clears nothing it did not write.
- When you then write a report to an event, first clear from that event whatever your mirror put there for a different account. A report that waited in the buffer across a sign-in must not pick up the new account's tags.

## Test it

Keep a fake of the SDK beside the adapter, and register the shared contract in `src/conformance.test.ts`:

```ts
import { consoleReporter } from "@priemskiyyy/flare-console";
import { testReporterAdapter } from "@priemskiyyy/flare/testing";

testReporterAdapter({
  name: "console",
  createAdapter: () => consoleReporter({ writer: () => {} }),
});
```

The suite checks what is provider independent: a valid description, capabilities that match the session's methods, a stable native handle, an untouched report, results whose evidence is no stronger than declared, and an idempotent lifecycle. It cannot check how you map each field, that the factory is cold, or that `open` rolls back. Those belong in your own tests, along with one that proves two concurrent reports for different accounts never share state.
