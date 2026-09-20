import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { expect, test, vi } from "vitest";

import { traceBreadcrumbs } from "src/traceBreadcrumbs";
import { fakeTraceSource } from "src/traceSource.fixture";

type Events = {
  "checkout.started": { cartId: string; total: number; email: string };
  "checkout.completed": { orderId: string; cardLast4: string };
  "page.viewed": { path: string };
};

const create = (clock = { now: 1_000 }) => {
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    now: () => clock.now,
  });
  flare.start();
  const trace = fakeTraceSource<Events>();
  const breadcrumbs = () => {
    flare.capture(new Error("read the breadcrumbs"));
    return mock.submissions.at(-1)?.report.breadcrumbs ?? [];
  };
  return { mock, flare, trace, clock, breadcrumbs };
};

test("bridging subscribes once, and stopping unsubscribes for good", () => {
  const { flare, trace, breadcrumbs } = create();

  const stop = traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: {
      "page.viewed": ({ path }) => ({ name: "pageViewed", data: { path } }),
    },
  });

  expect(trace.live()).toBe(1);

  stop();
  stop();
  trace.emit({
    name: "page.viewed",
    properties: { path: "/after-stop" },
    timestamp: 1_000,
  });

  expect(trace.live()).toBe(0);
  expect(breadcrumbs()).toEqual([]);
});

test("a source that keeps calling after it was told to stop is ignored", () => {
  const { flare, breadcrumbs } = create();
  const stubborn = fakeTraceSource<Events>({ ignoresUnsubscribe: true });
  const stop = traceBreadcrumbs({
    source: stubborn.source,
    flare,
    now: () => 1_000,
    map: {
      "page.viewed": ({ path }) => ({ name: "pageViewed", data: { path } }),
    },
  });

  stop();
  stubborn.emit({
    name: "page.viewed",
    properties: { path: "/late" },
    timestamp: 1_000,
  });

  expect(stubborn.live()).toBe(1);
  expect(breadcrumbs()).toEqual([]);
});

test("a mapped event becomes a breadcrumb with only the properties its mapper chose", () => {
  const { flare, trace, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: {
      "checkout.started": ({ cartId }) => ({
        name: "checkoutStarted",
        data: { cartId },
      }),
    },
  });

  trace.emit({
    name: "checkout.started",
    properties: { cartId: "cart_1", total: 4_200, email: "ada@example.com" },
    timestamp: 1_000,
  });

  expect(breadcrumbs()).toEqual([
    { name: "checkoutStarted", data: { cartId: "cart_1" }, timestamp: 1_000 },
  ]);
  expect(JSON.stringify(breadcrumbs())).not.toContain("ada@example.com");
});

test("an event without a mapper is ignored: there is no pass-through", () => {
  const { flare, trace, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: {
      "page.viewed": ({ path }) => ({ name: "pageViewed", data: { path } }),
    },
  });

  trace.emit({
    name: "checkout.completed",
    properties: { orderId: "o_1", cardLast4: "4242" },
    timestamp: 1_000,
  });

  expect(breadcrumbs()).toEqual([]);
});

test("a mapper can decline an event, and a breadcrumb needs no data", () => {
  const { flare, trace, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: {
      "page.viewed": ({ path }) =>
        path.startsWith("/admin") ? null : { name: "pageViewed" },
    },
  });

  trace.emit({
    name: "page.viewed",
    properties: { path: "/admin/users" },
    timestamp: 1_000,
  });
  trace.emit({
    name: "page.viewed",
    properties: { path: "/cart" },
    timestamp: 1_000,
  });

  expect(breadcrumbs()).toEqual([
    { name: "pageViewed", data: null, timestamp: 1_000 },
  ]);
});

test("the breadcrumb keeps the time the event occurred, not the time it was delivered", () => {
  const { flare, trace, clock, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: { "page.viewed": () => ({ name: "pageViewed" }) },
  });
  clock.now = 9_000;

  trace.emit({
    name: "page.viewed",
    properties: { path: "/cart" },
    timestamp: 1_250,
  });

  expect(breadcrumbs()[0]?.timestamp).toBe(1_250);
});

test("a source that hands a new subscriber its history adds nothing: what occurred before bridging is ignored", () => {
  const { flare, breadcrumbs } = create();
  const replaying = fakeTraceSource<Events>({
    history: [
      {
        name: "page.viewed",
        properties: { path: "/yesterday" },
        timestamp: 100,
      },
      {
        name: "page.viewed",
        properties: { path: "/earlier-today" },
        timestamp: 999,
      },
    ],
  });

  traceBreadcrumbs({
    source: replaying.source,
    flare,
    now: () => 1_000,
    map: {
      "page.viewed": ({ path }) => ({ name: "pageViewed", data: { path } }),
    },
  });
  replaying.emit({
    name: "page.viewed",
    properties: { path: "/now" },
    timestamp: 1_000,
  });

  expect(breadcrumbs().map((entry) => entry.data)).toEqual([{ path: "/now" }]);
});

test("an event that occurred under the previous account never becomes the next account's breadcrumb", () => {
  const { flare, trace, clock, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: {
      "checkout.started": ({ cartId }) => ({
        name: "checkoutStarted",
        data: { cartId },
      }),
    },
  });
  flare.user({ id: "ada" });
  clock.now = 2_000;
  flare.user({ id: "grace" });

  trace.emit({
    name: "checkout.started",
    properties: { cartId: "ada-cart", total: 1, email: "ada@example.com" },
    timestamp: 1_500,
  });
  trace.emit({
    name: "checkout.started",
    properties: { cartId: "grace-cart", total: 1, email: "grace@example.com" },
    timestamp: 2_100,
  });

  expect(breadcrumbs().map((entry) => entry.data)).toEqual([
    { cartId: "grace-cart" },
  ]);
});

test("a mapper that throws is contained: the source keeps dispatching and later events still arrive", () => {
  const { flare, trace, breadcrumbs } = create();
  const other = vi.fn();
  trace.source.subscribe(other);
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: {
      "page.viewed": ({ path }) => {
        if (path === "/broken") {
          throw new Error("mapper exploded");
        }
        return { name: "pageViewed", data: { path } };
      },
    },
  });

  expect(() =>
    trace.emit({
      name: "page.viewed",
      properties: { path: "/broken" },
      timestamp: 1_000,
    }),
  ).not.toThrow();
  trace.emit({
    name: "page.viewed",
    properties: { path: "/fine" },
    timestamp: 1_000,
  });

  expect(other).toHaveBeenCalledTimes(2);
  expect(breadcrumbs().map((entry) => entry.data)).toEqual([{ path: "/fine" }]);
});

test("what a mapper returns still passes through Flare's redaction", () => {
  const { flare, trace, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: {
      "checkout.completed": ({ orderId, cardLast4 }) => ({
        name: "checkoutCompleted",
        data: { orderId, secret: cardLast4 },
      }),
    },
  });

  trace.emit({
    name: "checkout.completed",
    properties: { orderId: "o_1", cardLast4: "4242" },
    timestamp: 1_000,
  });

  expect(breadcrumbs()[0]?.data).toEqual({
    orderId: "o_1",
    secret: "[Redacted]",
  });
});

test("a malformed event from a loosely typed source is ignored", () => {
  const { flare, trace, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: { "page.viewed": () => ({ name: "pageViewed" }) },
  });

  trace.emit(JSON.parse('{"name":"page.viewed","properties":{"path":"/x"}}'));
  trace.emit(JSON.parse('{"name":42,"properties":{},"timestamp":1000}'));
  trace.emit(JSON.parse("null"));

  expect(breadcrumbs()).toEqual([]);
});

test.each([Number.NaN, Number.POSITIVE_INFINITY])(
  "an unusable event time %s cannot become a breadcrumb for the current account",
  (timestamp) => {
    const { flare, trace, breadcrumbs } = create();
    traceBreadcrumbs({
      source: trace.source,
      flare,
      now: () => 1_000,
      map: { "page.viewed": () => ({ name: "pageViewed" }) },
    });

    trace.emit({
      name: "page.viewed",
      properties: { path: "/old" },
      timestamp,
    });

    expect(breadcrumbs()).toEqual([]);
  },
);

test("unreadable source events cannot interrupt the source's dispatch", () => {
  const { flare, trace, breadcrumbs } = create();
  traceBreadcrumbs({
    source: trace.source,
    flare,
    now: () => 1_000,
    map: { "page.viewed": () => ({ name: "pageViewed" }) },
  });
  const later = vi.fn();
  trace.source.subscribe(later);

  expect(() =>
    trace.emit({
      get name(): "page.viewed" {
        throw new Error("unreadable event");
      },
      properties: { path: "/old" },
      timestamp: 1_000,
    }),
  ).not.toThrow();
  expect(later).toHaveBeenCalledOnce();
  expect(breadcrumbs()).toEqual([]);
});

test("bridging is passive: it starts nothing and creates no report", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const trace = fakeTraceSource<Events>();

  traceBreadcrumbs({
    source: trace.source,
    flare,
    map: { "page.viewed": () => ({ name: "pageViewed" }) },
  });
  trace.emit({
    name: "page.viewed",
    properties: { path: "/cart" },
    timestamp: Date.now() + 1_000,
  });

  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);
  expect(flare.status.get()).toEqual({ state: "idle" });
});
