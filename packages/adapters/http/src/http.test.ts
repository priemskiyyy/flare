import { Flare } from "@priemskiyyy/flare";
import { afterEach, expect, test, vi } from "vitest";

import { fakeBackend } from "src/fakeBackend.fixture";
import { http } from "src/http";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const create = (options: Partial<Parameters<typeof http>[0]> = {}) => {
  const backend = fakeBackend();
  const flare = new Flare({
    destinations: {
      backend: http({
        endpoint: backend.endpoint,
        fetch: backend.fetch,
        ...options,
      }),
    },
  });
  return { backend, flare };
};

test("creating the adapter sends nothing and does not look for a fetch", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const backend = fakeBackend();

  http({ endpoint: backend.endpoint });
  http({ endpoint: backend.endpoint, fetch: backend.fetch });

  expect(fetch).not.toHaveBeenCalled();
  expect(backend.requests).toEqual([]);
});

test("a report is posted as JSON with its id as the idempotency key", async () => {
  const { backend, flare } = create();
  flare.start();

  const receipt = flare.capture(new Error("upload failed"), {
    tags: { area: "upload" },
  });
  await receipt.settled;

  expect(backend.requests).toHaveLength(1);
  expect(backend.requests[0]).toMatchObject({
    method: "POST",
    url: backend.endpoint,
    headers: {
      "content-type": "application/json",
      "idempotency-key": receipt.id,
    },
    body: {
      id: receipt.id,
      kind: "exception",
      tags: { area: "upload" },
      exception: { message: "upload failed" },
    },
  });
});

test("an acknowledged report is submitted with backend evidence and the backend's id", async () => {
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

test("an injected response keeps the event id it read once", async () => {
  const id = vi.fn().mockReturnValueOnce("event-1").mockReturnValue(42);
  const { flare } = create({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => Object.defineProperty({}, "id", { get: id }),
    }),
  });
  flare.start();

  await expect(flare.message("acknowledged").settled).resolves.toMatchObject({
    outcomes: { backend: { status: "submitted", event: { id: "event-1" } } },
  });
  expect(id).toHaveBeenCalledTimes(1);
});

test.each([
  { label: "no body", body: null },
  { label: "a body that is not JSON", body: "accepted" },
  { label: "JSON without an id", body: '{"ok":true}' },
])(
  "an acknowledgement with $label is still submitted, without an event id",
  async (row) => {
    const { backend, flare } = create();
    flare.start();
    backend.answerNext(200, row.body);

    await expect(
      flare.capture(new Error("boom")).settled,
    ).resolves.toMatchObject({
      outcomes: { backend: { status: "submitted", event: null } },
    });
  },
);

test("a refusal is a failure that names the status, and it is never retried", async () => {
  const { backend, flare } = create();
  flare.start();
  backend.answerNext(503);

  const status = await flare.capture(new Error("boom")).settled;

  expect(status).toMatchObject({ outcomes: { backend: { status: "failed" } } });
  expect(
    status.state === "settled" ? status.outcomes.backend : null,
  ).toMatchObject({
    error: new Error(
      `The http reporter could not POST ${backend.endpoint}: the server answered 503.`,
    ),
  });
  expect(backend.requests).toHaveLength(1);
});

test("an unreachable network is a failure too, and it is never retried", async () => {
  const offline = new TypeError("fetch failed");
  const { backend, flare } = create();
  flare.start();
  backend.failNext(offline);

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: { backend: { status: "failed", error: offline } },
  });
  expect(backend.requests).toHaveLength(1);
});

test("headers may be a function, awaited for every request so nothing it reads is stale", async () => {
  let version = 0;
  const { backend, flare } = create({
    headers: async () => {
      version += 1;
      return { "x-app-version": `build-${version}` };
    },
  });
  flare.start();

  await flare.capture(new Error("one")).settled;
  await flare.capture(new Error("two")).settled;

  expect(
    backend.requests.map((request) => request.headers["x-app-version"]),
  ).toEqual(["build-1", "build-2"]);
});

test("authorize is asked for the credentials of the account the report belongs to", async () => {
  const authorize = vi.fn(() => ({ authorization: "Bearer ada-token" }));
  const { backend, flare } = create({ authorize });
  flare.start();
  flare.user({ id: "ada" });

  await flare.capture(new Error("boom")).settled;

  expect(authorize).toHaveBeenCalledWith({ user: { id: "ada" } });
  expect(backend.requests[0]?.headers.authorization).toBe("Bearer ada-token");
});

test("header precedence is case insensitive, including credentials and protocol headers", async () => {
  const { backend, flare } = create({
    headers: {
      Authorization: "shared",
      authorization: "another shared value",
      "Content-Type": "text/plain",
      "Idempotency-Key": "shared-key",
    },
    authorize: () => ({
      Authorization: "Bearer account-token",
      "CONTENT-TYPE": "application/xml",
      "IDEMPOTENCY-KEY": "account-key",
    }),
  });
  flare.start();

  const receipt = flare.message("hello");
  await receipt.settled;

  expect(backend.requests[0]?.headers).toEqual({
    authorization: "Bearer account-token",
    "content-type": "application/json",
    "idempotency-key": receipt.id,
  });
});

test("an account switch while reading credential headers stops the request", async () => {
  const { backend, flare } = create({
    authorize: () => ({
      get authorization() {
        flare.user({ id: "grace" });
        return "Bearer grace-token";
      },
    }),
  });
  flare.start();
  flare.user({ id: "ada" });

  await expect(flare.message("captured as ada").settled).resolves.toMatchObject(
    {
      outcomes: {
        backend: { status: "skipped", reason: "auth-subject-mismatch" },
      },
    },
  );
  expect(backend.requests).toEqual([]);
});

test("a report buffered under one account is never sent with the next account's credentials", async () => {
  const authorize = vi.fn(() => ({ authorization: "Bearer grace-token" }));
  const { backend, flare } = create({ authorize });
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
  expect(authorize).not.toHaveBeenCalled();
  expect(backend.requests).toEqual([]);
});

test("an account switch while credentials are being fetched stops the request", async () => {
  let release: (headers: Record<string, string>) => void = () => {};
  const authorize = () =>
    new Promise<Record<string, string>>((resolve) => {
      release = resolve;
    });
  const { backend, flare } = create({ authorize });
  flare.start();
  flare.user({ id: "ada" });
  const receipt = flare.capture(new Error("captured as ada"));

  flare.user({ id: "grace" });
  release({ authorization: "Bearer grace-token" });

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      backend: { status: "skipped", reason: "auth-subject-mismatch" },
    },
  });
  expect(backend.requests).toEqual([]);
});

test("disposal while headers are pending prevents authorization and sending", async () => {
  let release = () => {};
  const headers = new Promise<Record<string, string>>((resolve) => {
    release = () => resolve({ "x-build": "1" });
  });
  const authorize = vi.fn(() => ({}));
  const { backend, flare } = create({ headers: () => headers, authorize });
  flare.start();
  const receipt = flare.message("pending headers");

  flare.dispose();
  release();
  await receipt.settled;

  expect(authorize).not.toHaveBeenCalled();
  expect(backend.requests).toEqual([]);
});

test("disposal while credentials are pending prevents sending", async () => {
  let release = () => {};
  const credentials = new Promise<Record<string, string>>((resolve) => {
    release = () => resolve({ authorization: "test" });
  });
  const { backend, flare } = create({ authorize: () => credentials });
  flare.start();
  const receipt = flare.message("pending credentials");

  flare.dispose();
  release();
  await receipt.settled;

  expect(backend.requests).toEqual([]);
});

test("without authorize there are no credentials to cross, so a buffered report is still sent under its own identity", async () => {
  const { backend, flare } = create();
  flare.user({ id: "ada" });
  const receipt = flare.capture(new Error("captured as ada, before start"));

  flare.user({ id: "grace" });
  flare.start();
  await receipt.settled;

  expect(backend.requests[0]?.body).toMatchObject({
    identity: { user: { id: "ada" } },
  });
});

test("the deadline aborts the request and leaves the outcome indeterminate", async () => {
  vi.useFakeTimers();
  const backend = fakeBackend();
  const flare = new Flare({
    destinations: {
      backend: http({ endpoint: backend.endpoint, fetch: backend.fetch }),
    },
    deadlineMs: 1_000,
  });
  flare.start();
  backend.hangNext();

  const receipt = flare.capture(new Error("slow backend"));
  await vi.advanceTimersByTimeAsync(1_000);

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { backend: { status: "indeterminate", reason: "deadline" } },
  });
  expect(backend.requests[0]?.signal.aborted).toBe(true);
});

test("where there is no fetch the destination is unavailable, and an injected one makes it available", () => {
  vi.stubGlobal("fetch", undefined);
  const backend = fakeBackend();

  expect(http({ endpoint: backend.endpoint }).available()).toEqual({
    available: false,
    reason:
      "No fetch is available. Pass one through the http reporter's fetch option.",
  });
  expect(
    http({ endpoint: backend.endpoint, fetch: backend.fetch }).available(),
  ).toEqual({
    available: true,
  });
});

test("a fetch installed after the adapter was created is honoured", async () => {
  vi.stubGlobal("fetch", undefined);
  const backend = fakeBackend();
  const flare = new Flare({
    destinations: { backend: http({ endpoint: backend.endpoint }) },
  });

  vi.stubGlobal("fetch", backend.fetch);
  flare.start();
  await flare.capture(new Error("boom")).settled;

  expect(backend.requests).toHaveLength(1);
});

test("the native handle names the endpoint", () => {
  const { backend, flare } = create();
  flare.start();

  expect(flare.destination("backend").native).toEqual({
    endpoint: backend.endpoint,
  });
});
