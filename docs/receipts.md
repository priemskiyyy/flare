---
description: "What a Flare receipt tells you about each destination, what each outcome means, and how much a piece of evidence actually proves."
---

# Receipts and evidence

`capture()` and `message()` return a receipt at once. Most code ignores it. It exists for the moments when you need to know, such as showing a banner when nothing could be reported, or asserting in a test.

```ts
const receipt = flare.capture(error);

receipt.id; // also the idempotency key the destinations received
receipt.status.get(); // the state right now
const status = await receipt.settled; // never rejects
```

`settled` resolves when the report was dropped, or when every selected destination has an outcome. It never rejects: a provider failure is an outcome, not an exception.

## The three states

| State     | Meaning                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `dropped` | The report went nowhere, and `reason` says why.                              |
| `pending` | Destinations were selected. `outcomes` holds `null` for those still working. |
| `settled` | Every selected destination has an outcome. The first answer stands.          |

A whole report is dropped for one of these reasons:

| Reason             | Why                                                            |
| ------------------ | -------------------------------------------------------------- |
| `disposed`         | The Flare was disposed.                                        |
| `reentrant`        | It was captured from inside an adapter, which would loop.      |
| `rate-limited`     | The storm limit was reached.                                   |
| `stale-scope`      | Its [scope](scopes.md) belongs to a previous account.          |
| `sanitizer-failed` | The [scrubber](privacy.md) failed, so the data was not sent.   |
| `route-failed`     | [Routing](routing.md) failed, so the audience was not widened. |
| `no-destinations`  | Routing selected nothing.                                      |

## Outcomes per destination

```ts
const status = await flare.capture(error).settled;

if (status.state === "settled") {
  const outcome = status.outcomes.sentry;

  if (outcome?.status === "submitted") {
    console.log(outcome.evidence, outcome.event?.id, outcome.losses);
  }
}
```

| Status          | Meaning                                                 | Reasons                                                                                                |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `submitted`     | The destination accepted it, as far as `evidence` goes. |                                                                                                        |
| `dropped`       | Flare or the provider decided not to send it.           | `buffer-overflow`, `buffer-expired`, `deduped`, `disposed`, `provider-filtered`                        |
| `skipped`       | This destination could not take this report.            | `unavailable`, `start-failed`, `unsupported-report-kind`, `auth-subject-mismatch`, `identity-mismatch` |
| `failed`        | The attempt failed, and `error` holds why.              |                                                                                                        |
| `indeterminate` | It may or may not have arrived. Do not retry blindly.   | `deadline`, `ambiguous`, `disposed`                                                                    |

`indeterminate` is the honest answer when a destination did not respond in time or was disposed mid-flight. The report may already be on its way, so treating it as failed would produce duplicates.

## Evidence

A `submitted` outcome says on what evidence, weakest first:

| Evidence                 | What it proves                                                     | Who gives it                 |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------- |
| `sdk-call-returned`      | The SDK call returned without throwing. Nothing more.              | Sentry, Crashlytics, console |
| `sdk-callback-completed` | The SDK ran its delivery callback for this event without an error. | Bugsnag                      |
| `backend-acknowledged`   | A server answered the request for this report with a success.      | the HTTP adapter             |

An event id from an SDK is not proof of delivery. The SDK creates it before anything leaves the device. Flare reports it as `event: { id }`, or `event: null` when no id is available, and claims only what the evidence says. Whether the provider then stored, grouped or displayed the event is outside what any client library can know.

## Losses

A provider that cannot represent part of a report does not fail it. The adapter sends what it can and lists the rest:

```ts
const status = await flare.capture(error).settled;
// with a Crashlytics destination, outcomes.crashlytics.losses:
// [{ path: "tags", reason: "unsupported" }, { path: "breadcrumbs", reason: "unsupported" }]
```

The reasons are `unsupported`, `truncated` and `invalid`. See [provider limitations](provider-limitations.md).

## Before start

A report captured before `start()`, or while a destination is still opening, waits in that destination's buffer. The buffer holds 30 reports for up to 60 seconds. When it is full the oldest report is dropped as `buffer-overflow`, and one that waits too long is dropped as `buffer-expired`. If the destination turns out to be unavailable, or its start failed, the waiting reports are `skipped` with that reason. Change the bounds with the `buffer` option.
