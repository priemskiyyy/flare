import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Application } from "src/Application";
import type { LedgerRuntime } from "src/types/LedgerRuntime";
import { startLedger } from "src/utils/startLedger";

class IntersectionObserverStub {
  observe() {}

  disconnect() {}
}

const runtimes: LedgerRuntime[] = [];

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  cleanup();

  for (const runtime of runtimes.splice(0)) {
    runtime.dispose();
  }

  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderApplication = () => {
  const ledger = startLedger({ latency: 0 });

  runtimes.push(ledger.runtime);

  const view = render(<Application {...ledger} />);

  return { ...ledger, view };
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

test("a payment reaches your API, Sentry and the console, redacted, under the account that made it", async () => {
  const { runtime } = renderApplication();

  press("Pay INV-1042");
  await waitForSettled();

  expect(readOutcome("Your API")).toContain("Submitted");
  expect(readOutcome("Your API")).toContain("backend-acknowledged");
  expect(readOutcome("Sentry")).toContain("Submitted");
  expect(readOutcome("Console")).toContain("Submitted");
  expect(readOutcome("PostHog")).toContain("Not routed");
  expect(readOutcome("Datadog")).toContain("Not routed");

  const [tracked] = runtime.receipts.getSnapshot();
  const report = runtime.findReport(tracked?.receipt.id ?? "");

  expect(report).toMatchObject({
    identity: { user: { id: "ada" } },
    tags: { area: "billing", plan: "pro" },
    contexts: {
      payment: { cardToken: "[Redacted]", iban: "[Redacted]", amount: 1_280 },
    },
  });
});

test("the payload marks each value Flare hid, and holds none of them", async () => {
  renderApplication();

  press("Pay INV-1042");
  await waitForSettled();

  const payload =
    within(readLatestReport()).getByLabelText("Sanitized payload");

  const marked = Array.from(
    payload.querySelectorAll("mark"),
    (mark) => mark.textContent,
  );

  expect(marked).toEqual(["[Redacted]", "[Redacted]"]);
  expect(
    within(readLatestReport()).getByText("2 hidden by Flare"),
  ).toBeTruthy();
  expect(payload.textContent).not.toContain("tok_live_4242");
});

test("a reminder is skipped by PostHog and Datadog, and its email address arrives scrubbed", async () => {
  const { providers } = renderApplication();

  press("Remind Northwind");
  await waitForSettled();

  expect(readOutcome("PostHog")).toContain("Skipped");
  expect(readOutcome("PostHog")).toContain("unsupported-report-kind");
  expect(readOutcome("Datadog")).toContain("Skipped");
  expect(readOutcome("Your API")).toContain("Not routed");
  expect(providers.sentry.inbox.getSnapshot()[0]?.title).toBe(
    "The reminder to [email] bounced",
  );
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

  await act(() => vi.advanceTimersByTimeAsync(3_100));

  const latest = readLatestReport().textContent;

  expect(latest).toContain("No destination got this report");
  expect(latest).toContain("stale-scope");
});

test("an upload shows that it is running, and cannot start twice", () => {
  vi.useFakeTimers();
  renderApplication();

  press("Attach receipt.pdf");

  expect(
    screen.getByText("Uploading receipt.pdf. Switch accounts now."),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Attach receipt.pdf" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

test("with your API offline, only its outcome fails", async () => {
  renderApplication();

  press("API offline");
  press("Pay INV-1042");
  await waitForSettled();

  expect(readOutcome("Your API")).toContain("Failed");
  expect(readOutcome("Your API")).toContain(
    "The report endpoint answered 503.",
  );
  expect(readOutcome("Sentry")).toContain("Submitted");
});

test("an API slower than the timeout leaves its outcome unconfirmed, not failed", async () => {
  vi.useFakeTimers();
  renderApplication();

  press("8 s");
  press("Pay INV-1042");

  await act(() => vi.advanceTimersByTimeAsync(3_100));

  expect(readOutcome("Your API")).toContain("Unconfirmed");
  expect(readOutcome("Your API")).toContain("timeout");
  expect(readOutcome("Sentry")).toContain("Submitted");
});

test("a report after an account switch carries nothing of the previous account", async () => {
  const { runtime } = renderApplication();

  press("Pay INV-1042");
  press("Grace Hopper");
  press("Pay INV-2207");

  await waitFor(() => {
    expect(
      screen.getByRole("list", { name: "Receipts" }).children,
    ).toHaveLength(2);
  });

  const [grace] = runtime.receipts.getSnapshot();
  const report = runtime.findReport(grace?.receipt.id ?? "");

  expect(report?.identity.user?.id).toBe("grace");
  expect(JSON.stringify(report?.breadcrumbs)).not.toContain("INV-1042");
  expect(JSON.stringify(report?.breadcrumbs)).not.toContain("Acme");
});

test("a report captured before start waits in the buffer and goes out on Start", async () => {
  renderApplication();

  press("Restart without starting");
  press("Pay INV-1042");

  expect(within(readLatestReport()).queryByText("Settled")).toBeNull();
  expect(readOutcome("Your API")).toContain("Sending");

  press("Start");
  await waitForSettled();

  expect(readOutcome("Your API")).toContain("Submitted");
});

test("the same error reported twice reaches every destination once", async () => {
  renderApplication();

  press("Report twice");
  await waitForSettled();

  expect(readOutcome("Sentry")).toContain("Dropped");
  expect(readOutcome("Sentry")).toContain("deduped");
});

test("the timeline says what happened in words", async () => {
  renderApplication();

  press("Pay INV-1042");
  await waitForSettled();

  const timeline = within(
    screen.getByRole("list", { name: "Timeline events" }),
  );

  expect(timeline.getByText("Sentry: Submitted")).toBeTruthy();
  expect(timeline.getByText("The signed-in account changed")).toBeTruthy();
});

test("unmounting cancels an unfinished upload before it reports", async () => {
  vi.useFakeTimers();

  const { runtime, view } = renderApplication();
  const accepted: string[] = [];

  const stop = runtime.flare.diagnostics.events.subscribe((event) => {
    accepted.push(event.type);
  });

  press("Attach receipt.pdf");
  view.unmount();
  await vi.advanceTimersByTimeAsync(3_100);

  expect(accepted).not.toContain("report accepted");
  stop();
});
