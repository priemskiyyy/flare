---
description: "Test code that reports through Flare with the mock adapter, assert on exactly what a destination received, and drive slow, failing and late providers deterministically."
---

# Testing

`@priemskiyyy/flare/mock` is a deterministic adapter for tests. It records every call and hands you the frozen report exactly as a real destination would have received it, after validation, redaction and bounds.

## Assert on what was reported

```ts
import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { expect, test } from "vitest";

test("a failed save is reported with its area", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { mock: mock.adapter } });
  flare.start();

  const receipt = flare.capture(new Error("Save failed"), {
    tags: { area: "editor", apiToken: "secret" },
  });
  await receipt.settled;

  const report = mock.submissions[0]?.report;
  expect(report?.tags).toEqual({ area: "editor", apiToken: "[Redacted]" });
});
```

Build your application's Flare from a function that takes the destinations, and tests can pass the mock while production passes the real adapters. Everything else, including your schema, your privacy options and your routing, is then the code under test.

## Drive a provider's timing

A real provider is slow, fails and answers late. Hold submissions and answer them when the test says:

```ts
import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { expect, test } from "vitest";

test("a provider failure is an outcome, not an exception", async () => {
  const mock = createMockAdapter({ hold: true });
  const flare = new Flare({ destinations: { mock: mock.adapter } });
  flare.start();

  const receipt = flare.capture(new Error("boom"));
  expect(receipt.status.get().state).toBe("pending");

  mock.submissions[0]?.fail(new Error("network down"));

  const status = await receipt.settled;
  expect(status).toMatchObject({
    state: "settled",
    outcomes: { mock: { status: "failed" } },
  });
});
```

| Option         | What it simulates                                                       |
| -------------- | ----------------------------------------------------------------------- |
| `hold`         | `submit` waits until the test calls `settle()` or `fail()`.             |
| `holdOpen`     | `open` waits, for reports captured while a destination is starting.     |
| `available`    | A provider that is not available in this environment.                   |
| `flush`        | A session with a flush, or with `"hold"`, one the test answers.         |
| `ambient`      | A session with an ambient integration, recorded on `sessions`.          |
| `capabilities` | Capabilities to declare, such as `messages: false`.                     |
| `onOpen`       | Runs inside `open`. Throw to stand for an SDK that fails to initialize. |
| `onSubmit`     | Runs inside `submit`. Throw, or return a result to answer at once.      |

Time is injectable too. Pass `now` to the Flare and use your test runner's fake timers for buffers, deadlines and the dedupe window.

## Dispose between tests

A Flare that is not disposed keeps its timers and its claim on a singleton SDK:

```ts
import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { afterEach, beforeEach } from "vitest";

let flare: Flare<{ mock: ReturnType<typeof createMockAdapter>["adapter"] }>;

beforeEach(() => {
  flare = new Flare({ destinations: { mock: createMockAdapter().adapter } });
  flare.start();
});

afterEach(() => {
  flare.dispose();
});
```

## React

Render with a `FlareProvider` over a mock-backed Flare. Nothing needs to be mocked at the module level, because the bindings take the Flare as a prop.

## Testing an adapter you wrote

`@priemskiyyy/flare/testing` registers the contract every adapter must keep. See [writing an adapter](writing-an-adapter.md).
