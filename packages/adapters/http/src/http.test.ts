import { Flare } from "@priemskiyyy/flare";
import { afterEach, expect, test, vi } from "vitest";

import { fakeRequest } from "src/fakeRequest.fixture";
import { http } from "src/http";

afterEach(() => {
  vi.useRealTimers();
});

const create = (client = fakeRequest(), timeout = 5_000) => {
  const flare = new Flare({
    destinations: { backend: http({ request: client.request }) },
    timeout,
  });

  return { client, flare };
};

test("creating the adapter sends nothing", () => {
  const client = fakeRequest();

  http({ request: client.request });

  expect(client.requests).toEqual([]);
});

test("each report reaches the request frozen and sanitized, with the signal of its deadline", async () => {
  const { client, flare } = create();

  flare.start();

  const receipt = flare.capture(new Error("charge failed"), {
    contexts: { card: { token: "sk_live_1", last4: "4242" } },
  });

  await receipt.settled;

  expect(client.requests).toHaveLength(1);

  const [sent] = client.requests;

  expect(sent?.report).toMatchObject({
    id: receipt.id,
    kind: "exception",
    exception: { message: "charge failed" },
    contexts: { card: { token: "[Redacted]", last4: "4242" } },
  });
  expect(Object.isFrozen(sent?.report)).toBe(true);
  expect(sent?.signal).toBeInstanceOf(AbortSignal);
});

test("a request that resolves with the backend's id is submitted with backend evidence and that id", async () => {
  const { flare } = create();

  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      backend: {
        status: "submitted",
        evidence: "backend-acknowledged",
        event: { id: "evt_1" },
        losses: [],
      },
    },
  });
});

test("a request that resolves with nothing is submitted without an event id", async () => {
  const { client, flare } = create();

  flare.start();
  client.answerNext();

  await expect(flare.message("note").settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      backend: {
        status: "submitted",
        evidence: "backend-acknowledged",
        event: null,
        losses: [],
      },
    },
  });
});

test("a request that rejects is a failed outcome, and it is never retried", async () => {
  const { client, flare } = create();

  flare.start();

  const refused = new Error("the backend answered 503");

  client.failNext(refused);

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: { backend: { status: "failed", error: refused } },
  });
  expect(client.requests).toHaveLength(1);
});

test("the deadline aborts the request's signal and leaves the outcome indeterminate", async () => {
  vi.useFakeTimers();

  const { client, flare } = create(fakeRequest(), 1_000);

  flare.start();
  client.hangNext();

  const receipt = flare.capture(new Error("slow backend"));

  await vi.advanceTimersByTimeAsync(1_000);

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { backend: { status: "indeterminate", reason: "timeout" } },
  });
  expect(client.requests[0]?.signal.aborted).toBe(true);
});

test("a report whose user signed out since it was captured is never sent, because the client authenticates as the next account", async () => {
  const { client, flare } = create();

  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  flare.user({ id: "grace" });
  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      backend: { status: "skipped", reason: "auth-subject-mismatch" },
    },
  });
  expect(client.requests).toEqual([]);
});

test("an anonymous report buffered before a sign-in is sent, and so is one for the account still signed in", async () => {
  const { client, flare } = create();
  const anonymous = flare.capture(new Error("during boot"));

  flare.user({ id: "ada" });

  const signedIn = flare.capture(new Error("as ada, before start"));

  flare.start();

  await expect(anonymous.settled).resolves.toMatchObject({
    outcomes: { backend: { status: "submitted" } },
  });
  await expect(signedIn.settled).resolves.toMatchObject({
    outcomes: { backend: { status: "submitted" } },
  });
  expect(client.requests.map((sent) => sent.report.id)).toEqual([
    anonymous.id,
    signedIn.id,
  ]);
});

test("the native handle is the request the application passed", () => {
  const { client, flare } = create();

  flare.start();

  expect(flare.destination("backend").native).toBe(client.request);
});
