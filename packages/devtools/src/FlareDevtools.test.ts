import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { fireEvent, within } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";

import { FlareDevtools } from "src/FlareDevtools";

const SECRET = "sk_live_12345";
const PREFERENCES_KEY = "@priemskiyyy/flare-devtools";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

// The log notifies once per microtask, and a settled receipt needs a turn too.
const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

const create = (options: Parameters<typeof createMockAdapter>[0] = {}) => {
  const mock = createMockAdapter({ name: "mocked", ...options });
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  return { mock, flare };
};

const mountDevtools = (
  options: ConstructorParameters<typeof FlareDevtools>[0],
) => {
  const host = document.body.appendChild(document.createElement("div"));
  const devtools = new FlareDevtools(options);
  devtools.mount(host);
  // Queries need an element; the shadow root's only child is the application root.
  const view = () => {
    const root = host.shadowRoot?.firstElementChild;

    if (!(root instanceof HTMLElement)) {
      throw new Error("Expected the devtools root inside the shadow root");
    }

    return within(root);
  };
  const text = () => host.shadowRoot?.textContent ?? "";
  const panel = () =>
    view().getByRole("complementary", { name: "Flare devtools" });
  const rows = () =>
    Array.from(
      view().getByLabelText("Event timeline").querySelectorAll("details"),
    );
  const types = () =>
    rows().map((row) => row.querySelector(".event-type")?.textContent);

  return { host, devtools, view, text, panel, rows, types };
};

test("the panel observes a Flare without starting it or creating a report", async () => {
  const { mock, flare } = create();
  flare.user({ id: "ada" });
  flare.breadcrumb("opened");
  flare.capture(new Error("buffered before start"));

  const { devtools, view, panel } = mountDevtools({
    flare,
    initialIsOpen: true,
  });
  await macrotask();

  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);
  expect(flare.status.get()).toEqual({ state: "idle" });
  expect(panel().querySelector(".status")?.textContent).toBe("idle");
  expect(panel().querySelector(".counters")?.textContent).toBe(
    "identity #1 · 1 breadcrumb · 1 pending",
  );
  const destination = within(
    view().getByRole("navigation", { name: "Flare destinations" }),
  ).getByRole("button", { name: /primary/ });
  expect(destination.textContent).toContain("mocked · idle · 1 buffered");
  devtools.unmount();
});

test("the panel follows the Flare as it changes, and never shows report content", async () => {
  const { flare } = create();
  const { devtools, view, text, panel, types } = mountDevtools({
    flare,
    initialIsOpen: true,
  });

  flare.start();
  flare.capture(new Error(`charge failed for ${SECRET}`), {
    tags: { note: SECRET },
  });
  await macrotask();

  expect(panel().querySelector(".status")?.textContent).toBe("started");
  expect(view().getByRole("button", { name: /primary/ }).textContent).toContain(
    "mocked · ready",
  );
  // Newest first.
  expect(types()).toEqual([
    "destination outcome",
    "destination submit",
    "report accepted",
    "destination ready",
    "destination starting",
    "started",
  ]);
  expect(text()).not.toContain(SECRET);
  devtools.unmount();
});

test("selecting a destination shows what it declared and narrows the timeline to it", async () => {
  const first = createMockAdapter({ name: "mocked", flush: true });
  const second = createMockAdapter({
    name: "other",
    capabilities: { messages: false },
  });
  const flare = new Flare({
    destinations: { primary: first.adapter, backup: second.adapter },
  });
  const { devtools, view, rows } = mountDevtools({
    flare,
    initialIsOpen: true,
  });
  flare.start();
  flare.capture(new Error("to both"));
  await macrotask();
  const everything = rows().length;

  fireEvent.click(view().getByRole("button", { name: /backup/ }));
  await macrotask();

  const detail = view().getByRole("region", { name: "backup destination" });
  expect(
    within(detail).getByText("messages").nextElementSibling?.textContent,
  ).toBe("no");
  expect(
    within(detail).getByText("evidence").nextElementSibling?.textContent,
  ).toBe("sdk-call-returned");
  expect(
    within(detail).getByText("flush").nextElementSibling?.textContent,
  ).toBe("none");
  expect(rows().length).toBeLessThan(everything);
  expect(
    rows().map((row) => row.querySelector(".event-destination")?.textContent),
  ).not.toContain("primary");
  // What belongs to no destination still explains what this one saw.
  expect(rows().some((row) => row.textContent?.includes("started"))).toBe(true);

  fireEvent.click(within(detail).getByRole("button", { name: "Close detail" }));
  await macrotask();

  expect(rows()).toHaveLength(everything);
  expect(
    view()
      .getByRole("button", { name: /All destinations/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  devtools.unmount();
});

test("what did not arrive is an error: it fills the error chip, matches the search, and lights the launcher while closed", async () => {
  const { flare } = create({
    onSubmit: () => {
      throw new Error("the provider is down");
    },
  });
  const { devtools, view, host, panel, rows } = mountDevtools({
    flare,
    initialIsOpen: true,
  });
  flare.start();
  // The snapshot is announced once per microtask.
  await macrotask();

  fireEvent.keyDown(panel(), { key: "Escape" });
  const launcher = () =>
    view().getByRole("button", { name: "Open Flare devtools" });
  expect(launcher().querySelector(".dot")?.getAttribute("data-state")).toBe(
    "started",
  );

  // Timestamps are milliseconds; the close and the failure must not share one.
  await macrotask();
  flare.capture(new Error("will fail"));
  await macrotask();

  expect(launcher().querySelector(".dot")?.getAttribute("data-state")).toBe(
    "error",
  );
  fireEvent.click(launcher());
  expect(host.shadowRoot?.activeElement).toBe(panel());

  const kinds = view().getByRole("group", { name: "Event kinds" });
  fireEvent.click(within(kinds).getByRole("button", { name: "Errors 1" }));
  expect(rows()).toHaveLength(1);
  expect(rows()[0]?.textContent).toContain("destination outcome");
  expect(rows()[0]?.textContent).toContain("failed");
  // The provider's own error is not part of any diagnostic event.
  expect(host.shadowRoot?.textContent).not.toContain("the provider is down");

  fireEvent.input(view().getByRole("searchbox", { name: "Filter events" }), {
    target: { value: "nothing matches this" },
  });
  expect(view().getByText("No matching events")).toBeTruthy();
  fireEvent.click(view().getByRole("button", { name: "Clear filters" }));
  expect(rows().length).toBeGreaterThan(1);

  // An error that was on screen while the panel was open has been seen.
  await macrotask();
  fireEvent.keyDown(panel(), { key: "Escape" });
  expect(launcher().querySelector(".dot")?.getAttribute("data-state")).toBe(
    "started",
  );
  devtools.unmount();
});

test("a report that arrived does not light the launcher", async () => {
  const { flare } = create();
  const { devtools, view } = mountDevtools({ flare });
  flare.start();
  await macrotask();

  flare.capture(new Error("delivered"));
  await macrotask();

  expect(
    view()
      .getByRole("button", { name: "Open Flare devtools" })
      .querySelector(".dot")
      ?.getAttribute("data-state"),
  ).toBe("started");
  devtools.unmount();
});

test("pausing stops recording, resuming continues it, clearing forgets everything, and none of it touches the Flare", async () => {
  const { mock, flare } = create();
  const { devtools, view, text, rows } = mountDevtools({
    flare,
    initialIsOpen: true,
    maxEvents: 3,
  });
  flare.start();
  await macrotask();

  // Three is the limit, so nothing earlier than the last three events is left.
  expect(rows()).toHaveLength(3);

  fireEvent.click(view().getByRole("button", { name: "Pause" }));
  flare.capture(new Error("while paused"));
  await macrotask();
  expect(text()).not.toContain("report accepted");

  fireEvent.click(view().getByRole("button", { name: "Clear" }));
  await macrotask();
  expect(view().getByText("Recording paused")).toBeTruthy();

  fireEvent.click(view().getByRole("button", { name: "Resume" }));
  flare.message("after resuming");
  await macrotask();
  expect(rows()).toHaveLength(3);
  expect(text()).toContain("report accepted");
  expect(mock.submissions).toHaveLength(2);

  devtools.setMaxEvents(1);
  await macrotask();
  expect(rows()).toHaveLength(1);
  devtools.unmount();
});

test("an empty timeline says it is waiting", () => {
  const { flare } = create();
  const { devtools, view } = mountDevtools({ flare, initialIsOpen: true });

  expect(view().getByText("Waiting for events")).toBeTruthy();
  devtools.unmount();
});

test("the launcher opens the panel, the panel resizes and docks, Escape closes it, and the state is remembered", () => {
  const { flare } = create();
  const first = mountDevtools({ flare });

  expect(
    first.view().queryByRole("complementary", { name: "Flare devtools" }),
  ).toBeNull();
  fireEvent.click(
    first.view().getByRole("button", { name: "Open Flare devtools" }),
  );
  const panel = first.panel();
  expect(first.host.shadowRoot?.activeElement).toBe(panel);
  const handle = () =>
    first.view().getByRole("separator", { name: "Resize devtools" });
  fireEvent.keyDown(handle(), { key: "ArrowUp" });
  expect(panel.style.height).toBe("444px");
  fireEvent.click(
    first.view().getByRole("button", { name: "Dock to the right" }),
  );
  expect(panel.dataset.position).toBe("right");
  fireEvent.keyDown(handle(), { key: "ArrowLeft" });
  expect(panel.style.width).toBe("544px");
  fireEvent.click(
    first.view().getByRole("button", { name: "Dock to the bottom" }),
  );
  expect(panel.style.height).toBe("444px");
  fireEvent.keyDown(panel, { key: "Escape" });
  const launcher = first
    .view()
    .getByRole("button", { name: "Open Flare devtools" });
  expect(first.host.shadowRoot?.activeElement).toBe(launcher);
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "")).toEqual({
    isOpen: false,
    height: 444,
    width: 544,
    position: "bottom",
  });
  first.devtools.unmount();

  // The remembered state wins over the option, and restoring never steals focus.
  const second = mountDevtools({ flare, initialIsOpen: true });
  expect(
    second.view().getByRole("button", { name: "Open Flare devtools" }),
  ).toBeTruthy();
  expect(second.host.shadowRoot?.activeElement).toBeNull();
  second.devtools.unmount();
});

test("setFlare follows another Flare, history survives a remount, and mounting twice throws", async () => {
  const original = create();
  const replacement = create();
  const { devtools, host, rows, types } = mountDevtools({
    flare: original.flare,
    initialIsOpen: true,
  });
  original.flare.start();
  await macrotask();
  const recorded = rows().length;

  expect(() => devtools.mount(host)).toThrow(
    "Flare devtools are already mounted. Call unmount() first.",
  );

  devtools.setFlare(replacement.flare);
  replacement.flare.start();
  original.flare.message("the old Flare is no longer observed");
  await macrotask();

  // Counting rows would not tell the two apart: a message makes as many events as a start.
  expect(types().filter((type) => type === "started")).toHaveLength(2);
  expect(types()).not.toContain("report accepted");

  devtools.unmount();
  devtools.unmount();
  expect(host.shadowRoot?.childElementCount).toBe(0);
  devtools.mount(host);

  expect(rows()).toHaveLength(recorded * 2);
  devtools.unmount();
});

test("unmounting stops observing, so nothing is recorded or leaked afterwards", () => {
  const { flare } = create();
  const live = { snapshots: 0, events: 0 };
  const subscribe = flare.diagnostics.subscribe;
  const subscribeEvents = flare.diagnostics.events.subscribe;
  vi.spyOn(flare.diagnostics, "subscribe").mockImplementation((listener) => {
    live.snapshots += 1;
    const stop = subscribe(listener);
    return () => {
      live.snapshots -= 1;
      stop();
    };
  });
  vi.spyOn(flare.diagnostics.events, "subscribe").mockImplementation(
    (listener) => {
      live.events += 1;
      const stop = subscribeEvents(listener);
      return () => {
        live.events -= 1;
        stop();
      };
    },
  );
  const { devtools } = mountDevtools({ flare });

  expect(live).toEqual({ snapshots: 1, events: 1 });

  devtools.unmount();

  expect(live).toEqual({ snapshots: 0, events: 0 });
});

test("names are shown as text, never parsed as markup", () => {
  const mock = createMockAdapter({ name: "<img src=x onerror=alert(1)>" });
  const flare = new Flare({ destinations: { "<b>bold</b>": mock.adapter } });
  const { devtools, host, text } = mountDevtools({
    flare,
    initialIsOpen: true,
  });

  expect(host.shadowRoot?.querySelector("img")).toBeNull();
  expect(host.shadowRoot?.querySelector("b")).toBeNull();
  expect(text()).toContain("<b>bold</b>");
  devtools.unmount();
});
