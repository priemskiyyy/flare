import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import { render } from "solid-js/web";
import { afterEach, expect, test, vi } from "vitest";

import { startLedger } from "examples/shared/ledger/utils/startLedger";
import { Application } from "src/Application";

const disposals: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposals.splice(0)) {
    dispose();
  }

  vi.useRealTimers();
});

const renderApplication = () => {
  const { providers, runtime } = startLedger({ latency: 0 });
  const root = document.createElement("div");

  document.body.append(root);

  const dispose = render(
    () => <Application runtime={runtime} providers={providers} />,
    root,
  );

  let isMounted = true;

  // A test may unmount first; the cleanup then leaves the root alone.
  const unmount = () => {
    if (!isMounted) {
      return;
    }

    isMounted = false;
    dispose();
  };

  disposals.push(() => {
    unmount();
    root.remove();
    runtime.dispose();
  });

  return { runtime, unmount };
};

const press = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

const readLatestReport = () =>
  screen.getByRole("region", { name: "Latest report" });

const readOutcome = (destination: string) =>
  within(readLatestReport()).getByRole("listitem", { name: destination })
    .textContent;

const waitForSettled = () =>
  waitFor(() => {
    expect(within(readLatestReport()).getByText("Settled")).toBeTruthy();
  });

test("Ledger opens signed in as Ada, with nothing reported yet", () => {
  renderApplication();

  expect(
    screen
      .getByRole("button", { name: "Ada Lovelace" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getByRole("list", { name: "Invoices" })).toBeTruthy();
  expect(
    within(readLatestReport()).getByText("Nothing reported yet"),
  ).toBeTruthy();
});

test("a payment reaches your API, Sentry and the console, and routing leaves PostHog out", async () => {
  renderApplication();

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
  renderApplication();

  press("Break the preview");

  expect(screen.getByRole("alert").textContent).toContain(
    "The preview crashed and was reported.",
  );

  await waitFor(() => {
    expect(
      within(readLatestReport()).getByText("Render the preview"),
    ).toBeTruthy();
  });

  press("Reset the preview");

  expect(screen.getByText("The preview is rendering normally.")).toBeTruthy();
});

test("an upload that outlives an account switch is dropped rather than charged to the next account", async () => {
  vi.useFakeTimers();
  renderApplication();

  press("Attach receipt.pdf");
  press("Grace Hopper");

  await vi.advanceTimersByTimeAsync(3_100);

  const latest = readLatestReport().textContent;

  expect(latest).toContain("No destination got this report");
  expect(latest).toContain("stale-scope");
});

test("unmounting leaves the Flare to the host", () => {
  const { runtime, unmount } = renderApplication();

  unmount();

  expect(runtime.flare.status.get().state).toBe("started");
});
