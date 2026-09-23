import { fireEvent, waitFor, within } from "@testing-library/dom";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, expect, test, vi } from "vitest";

import { startLedger } from "examples/shared/ledger/utils/startLedger";
import Application from "src/Application.svelte";

const disposals: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const dispose of disposals.splice(0)) {
    await dispose();
  }

  vi.useRealTimers();
});

const mountApplication = () => {
  const { providers, runtime } = startLedger({ latency: 0 });
  const target = document.createElement("div");

  document.body.append(target);

  const application = mount(Application, {
    target,
    props: { providers, runtime },
  });

  // Effects run after mount, and unmounting tears down only what has run.
  flushSync();

  let isMounted = true;

  // A test may unmount first; the cleanup then leaves the component alone.
  const unmountApplication = async () => {
    if (!isMounted) {
      return;
    }

    isMounted = false;
    await unmount(application);
  };

  disposals.push(async () => {
    await unmountApplication();
    target.remove();
    runtime.dispose();
  });

  const view = within(target);

  const press = (name: string) => {
    fireEvent.click(view.getByRole("button", { name }));
    flushSync();
  };

  const latestReport = () =>
    within(view.getByRole("region", { name: "Latest report" }));

  const readOutcome = (destination: string) =>
    latestReport().getByRole("listitem", { name: destination }).textContent;

  const waitForSettled = () =>
    waitFor(() => {
      expect(latestReport().getByText("Settled")).toBeTruthy();
    });

  return {
    runtime,
    unmountApplication,
    view,
    press,
    latestReport,
    readOutcome,
    waitForSettled,
  };
};

test("Ledger opens signed in as Ada, with nothing reported yet", () => {
  const { view, latestReport } = mountApplication();

  expect(
    view
      .getByRole("button", { name: "Ada Lovelace" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(view.getByRole("list", { name: "Invoices" })).toBeTruthy();
  expect(latestReport().getByText("Nothing reported yet")).toBeTruthy();
});

test("a payment reaches your API, Sentry and the console, and routing leaves PostHog out", async () => {
  const { press, readOutcome, waitForSettled } = mountApplication();

  press("Pay INV-1042");
  await waitForSettled();

  expect(readOutcome("Your API")).toContain("Submitted");
  expect(readOutcome("Your API")).toContain("backend-acknowledged");
  expect(readOutcome("Sentry")).toContain("Submitted");
  expect(readOutcome("Console")).toContain("Submitted");
  expect(readOutcome("PostHog")).toContain("Not routed");
  expect(readOutcome("Datadog")).toContain("Not routed");
});

test("the preview's boundary reports the render error, and the preview can be reset", async () => {
  const { view, press, latestReport } = mountApplication();

  press("Break the preview");

  expect(view.getByRole("alert").textContent).toContain(
    "The preview crashed and was reported.",
  );

  await waitFor(() => {
    expect(latestReport().getByText("Render the preview")).toBeTruthy();
  });

  press("Reset the preview");

  expect(view.getByText("The preview is rendering normally.")).toBeTruthy();
});

test("an upload that outlives an account switch is dropped rather than charged to the next account", async () => {
  vi.useFakeTimers();

  const { press, latestReport } = mountApplication();

  press("Attach receipt.pdf");
  press("Grace Hopper");
  await vi.advanceTimersByTimeAsync(3_100);
  flushSync();

  const latest = latestReport().getByText("No destination got this report")
    .parentElement?.textContent;

  expect(latest).toContain("stale-scope");
});

test("unmounting leaves the Flare to the host", async () => {
  const { runtime, unmountApplication } = mountApplication();

  await unmountApplication();

  expect(runtime.flare.status.get().state).toBe("started");
});
