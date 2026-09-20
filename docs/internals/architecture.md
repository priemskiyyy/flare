---
description: "How the Flare core is put together: its owners, the order a report moves through them, and the test that guards each invariant."
---

# Runtime architecture

Flare guarantees how a report is constructed, isolated, sanitized, routed and handed to a destination. It claims nothing about what a provider does afterwards unless the destination gives evidence for that exact boundary. This page describes the parts that keep that guarantee and names the test that guards each rule.

## Owners

Every piece of state has one owner, and only the first three names below are exported.

| Owner                                      | Responsibility                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `Flare`                                    | The facade. Holds configuration, runs the report pipeline, routes, and owns the receipts.              |
| `createReporterAdapter`                    | Gives an adapter idempotent disposal, refusal after disposal, startup rollback and aggregated cleanup. |
| `createMockAdapter`, `testReporterAdapter` | The deliberately badly behaved test double, and the contract every adapter must keep.                  |
| `SessionState`                             | The identity generation, session tags, session contexts and the breadcrumb ring.                       |
| `DestinationRuntime`                       | One destination: its session, startup buffer, the deadline of each submission, flush and disposal.     |
| `DedupeIndex`, `RateWindow`                | What each destination has already been sent, and the per-minute storm limit.                           |
| `Diagnostics`                              | The passive snapshot and event stream.                                                                 |

Report intake is separate from lifecycle orchestration: `prepareReportLayer` composes metadata preparation and `prepareReportPayload` normalizes an exception or message. Their behavior is exercised through the public capture and privacy tests. Leaf operations such as `normalizeException`, `sanitizeValue`, `validateDeclared`, `composeReport`, `fitReport` and `parseSubmissionResult` have focused tests.

Exception text and metadata strings share `sanitizeString`, which scrubs before truncating and records losses in the caller's list. Exception normalization collects those losses directly instead of merging intermediate result wrappers. Array sanitization snapshots descriptors only for the retained prefix, so its work is bounded by the breadth limit even when the input array is large. Capture metadata options and error-like name/message fields are read once before their values are validated and used.

Object sanitization collects enumerable string-key descriptors until it can determine the retained prefix and truncation. It avoids copying all descriptors, while key enumeration still depends on input size. Retained descriptors are snapshotted before application scrubbers run.

Normalized exceptions, their members and mapping losses are frozen before routing and fan-out. Aggregate members are read into a core-owned array, so application array methods cannot bypass normalization. Receipt completion derives from its frozen outcome snapshot. Provider-result parsing reads each relevant field once and freezes the copied event reference and mapping losses.

Report, receipt, session and lifecycle status types expose their frozen fields as readonly. Runtime and destination statuses are frozen before observers can read them. Each destination copies and freezes its declared capabilities once; submissions, destination handles and diagnostic snapshots share that declaration. Diagnostic snapshots are frozen too, so observation cannot change submission policy or another observer's counts. Adapters copy fields into provider-owned objects when they need to edit them. Ambient integrations share a frozen snapshot, replaced only when metadata changes. Breadcrumb-only updates reuse it. Repeating the same user traits or tag value, or removing absent metadata, preserves the session snapshot and sends no ambient update; identity comparison still uses the private, unredacted id.

## The path of a report

1. Refusals that need no work: disposed, reentrant, rate limited, stale scope.
2. `normalizeException` turns the thrown value into bounded plain data. It reads only `name`, `message`, `stack`, `cause` and `errors`, each behind a guard.
3. The capture options are validated against the schema and sanitized. An invalid piece is dropped and recorded as a loss; the report continues.
4. `composeReport` merges application defaults, the session, the scope and the options, in that order.
5. `fitReport` sheds the oldest breadcrumbs, then the newest contexts, until the report fits.
6. Routing selects destinations, reusing the runtimes resolved at construction for a fixed default route. A failure here drops the report rather than widening its audience.
7. Per destination: dedupe, then the startup buffer or an immediate submission under a deadline.
8. Each outcome lands on the receipt. The first answer of a destination stands.

Session data takes the same validate and sanitize steps when it is set, not when it is reported. That is what keeps unsanitized data out of the breadcrumb ring, the startup buffer, diagnostics and ambient integrations.

A report snapshots its session before preparation calls application validators or scrubbers. Those callbacks cannot relabel it by switching accounts. A session mutation prepared across an account switch is discarded. Ambient updates stop when a provider callback replaces their snapshot, and breadcrumbs stop when their account changes, so later providers cannot receive an older update over the newer session.

## Principles

1. The thrown value never leaves the core. An adapter receives frozen, sanitized plain data and nothing else.
2. Privacy outranks delivery. A scrubber that throws costs the data it was given; a route that throws costs the report.
3. Delivery outranks metadata. A tag, context or breadcrumb that fails its schema costs only itself.
4. Flare is a best-effort feature of its host. Reporting and session calls never throw into the application. Two programming mistakes do throw: a misconfigured constructor, and asking `destination()` for a name that was never configured.
5. Every change replaces a frozen snapshot. A report composed earlier cannot be reached by a later change.
6. A scope belongs to the identity it was created under and never adopts a later one.
7. Every entry a destination accepts is settled exactly once, whatever the adapter does, and through one place, so every outcome is announced to diagnostics whichever path it took.
8. A deadline is `indeterminate`, never `failed`: the provider may still have sent the report.
9. Observation is passive. Reading a status, a native handle or diagnostics opens nothing and creates no report.
10. The core never branches on an adapter name. Adding a provider is one new package.

## Adapter layout

Sentry and Bugsnag each keep their browser and React Native entry points in one provider package. The report mapping and injected SDK types are shared; the `/react-native` entry point selects the platform's queue and flush guarantees. Crashlytics is a separate provider package because it has its own native-only API.

The packages import no provider SDK at runtime, so a platform directory would not reduce bundled SDK code. Separate platform packages become useful when their mapping, options or dependencies need independent implementations.

## Invariants and their tests

| Invariant                                                                               | Test                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Construction is cold and safe on a server                                               | `Flare.test.ts`: "constructing a Flare is cold: nothing opens, no timer starts, no global is touched"; `index.test.ts`: "importing and constructing on a server is inert: no timer, no listener, nothing opened"                    |
| A repeated start changes nothing and tells nobody                                       | `Flare.test.ts`: "start opens every destination once, however often it is called"; "starting again tells no status observer anything, because nothing changed"                                                                      |
| A report captured before start is delivered later                                       | `Flare.test.ts`: "a report captured before start is delivered once the destination is ready"                                                                                                                                        |
| A failed start can be retried without losing the buffer                                 | `DestinationRuntime.test.ts`: "a start that throws leaves the destination failed and keeps its buffer for a retry"                                                                                                                  |
| A session that arrives after disposal has no owner                                      | `DestinationRuntime.test.ts`: "a session that arrives after disposal is released at once and never used"                                                                                                                            |
| Disposal settles what is in flight                                                      | `Flare.test.ts`: "disposal during a submission settles its receipt as indeterminate"                                                                                                                                                |
| A late answer is ignored                                                                | `DestinationRuntime.test.ts`: "a hanging provider is cut off at the deadline as indeterminate, and its late answer is ignored"; `createReceipt.test.ts`: "a late answer is ignored even while another destination is still pending" |
| Concurrent reports cannot share event-local context                                     | `isolation.test.ts`: "concurrent reports never see each other's event-local context"                                                                                                                                                |
| A pending report keeps the identity it was captured under                               | `isolation.test.ts`: "a report keeps the context it was captured with, whatever the session does while it is pending"                                                                                                               |
| A breadcrumb never crosses an account boundary                                          | `isolation.test.ts`: "a breadcrumb that occurred before the current identity began is not kept"; "a breadcrumb recorded now is kept even when the wall clock steps backwards"                                                       |
| A stale scope adopts nobody                                                             | `isolation.test.ts`: "a scope created before an account switch is stale and adopts nobody"; "logging out makes an old asynchronous scope stale too"                                                                                 |
| No account can see another's data                                                       | `isolation.test.ts`: "aggressively interleaved users, scopes and captures never leak across accounts"                                                                                                                               |
| Identity follows the full id even when its report value is redacted or bounded          | `SessionState.test.ts`: "identity follows the real id even when the visible user is redacted"; `isolation.test.ts`: "accounts whose reported ids share a truncated prefix still have separate sessions"                             |
| Privacy runs before retention and fan-out                                               | `privacy.test.ts`: "redaction runs before the startup buffer, the mock, diagnostics and fan-out ever see the data"                                                                                                                  |
| A failing scrubber fails closed                                                         | `privacy.test.ts`: "a scrubber that throws fails closed: the report is dropped, not sent unscrubbed"                                                                                                                                |
| A secret is scrubbed before it can be cut in half                                       | `sanitizeValue.test.ts`: "a secret that straddles the cut is scrubbed whole before the string is cut"                                                                                                                               |
| A string rule is never a substring match                                                | `sanitizeValue.test.ts`: "a string rule is an exact key, never a substring"                                                                                                                                                         |
| Sanitization skips accessors and serialization hooks, and contains throwing proxy traps | `sanitizeValue.test.ts`: "getters and toJSON are never run"; "array accessors and custom slice methods are never run"; `normalizeException.test.ts`: "a proxy whose every trap throws is still reported"                            |
| Prototype-named data remains own fields                                                 | `Flare.test.ts`: "prototype-named destinations retain their receipts and flush results"; "prototype-named tags and contexts remain own report fields"                                                                               |
| A schema failure costs only the invalid piece                                           | `privacy.test.ts`: "a schema failure costs only the invalid piece and is recorded on the report"                                                                                                                                    |
| Routing fails closed                                                                    | `routing.test.ts`: "a route that throws fails closed: the report goes nowhere"; "a route or a to that names an unknown destination fails closed too"                                                                                |
| `to` replaces the default                                                               | `routing.test.ts`: "a per-capture to replaces the default and never merges with it"                                                                                                                                                 |
| One destination never blocks or repeats another                                         | `routing.test.ts`: "one destination failing never blocks or repeats another"                                                                                                                                                        |
| Dedupe is per destination and per identity                                              | `guards.test.ts`: "an explicit dedupe key holds per destination and per identity"                                                                                                                                                   |
| The same Error is reported again later                                                  | `guards.test.ts`: "the same Error captured twice in quick succession is sent once, and again later"                                                                                                                                 |
| A feedback loop cannot start                                                            | `guards.test.ts`: "a capture made from inside an adapter's submit is refused, so a feedback loop cannot start"                                                                                                                      |
| An error storm is bounded                                                               | `guards.test.ts`: "an error storm is cut off per minute, announced once, and let through again afterwards"                                                                                                                          |
| Flush is a barrier, and a timeout proves nothing                                        | `flush.test.ts`: "flush is a barrier: captures made after the call do not extend it"; "a flush that times out says so, and neither cancels nor disproves the submission"                                                            |
| Event-local metadata never reaches provider globals                                     | `ambient.test.ts`: "event-local metadata never reaches the ambient integration"                                                                                                                                                     |
| Every outcome is announced, whichever path it took                                      | `diagnostics.test.ts`: "every outcome a destination gives is announced, whichever path it took"; "what happens to a buffered report is announced too: held, overflowed, expired, submitted and disposed"                            |
| Observation is passive and payload free                                                 | `diagnostics.test.ts`: "observing diagnostics is passive: it opens nothing and creates no report"; "the snapshot holds counts and statuses, never report content"                                                                   |
| An adapter's answer is parsed, not trusted                                              | `parseSubmissionResult.test.ts`: "$label is not a result", in the row "a reason only the core may give"                                                                                                                             |
| The public surface cannot drift silently                                                | `index.test.ts`; `types/schema.contracts.ts`; `utils/Flare.contracts.ts`                                                                                                                                                            |

Each of these tests has been watched failing against a deliberately broken implementation.
