import { fireEvent, waitFor, within } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";
import { createApp, nextTick } from "vue";

import { startLedger } from "examples/shared/ledger/utils/startLedger";
import Application from "src/Application.vue";

const disposals: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposals.splice(0)) {
    dispose();
  }

  vi.useRealTimers();
});

const mountApplication = () => {
  const { providers, runtime } = startLedger({ latency: 0 });
  const root = document.createElement("div");
  const application = createApp(Application, { providers, runtime });
  let isMounted = true;

  // A test may unmount first; the cleanup then leaves the app alone.
  const unmount = () => {
    if (!isMounted) {
      return;
    }

    isMounted = false;
    application.unmount();
  };

  document.body.append(root);
  application.mount(root);
  disposals.push(() => {
    unmount();
    root.remove();
    runtime.dispose();
  });

  return { runtime, unmount, page: within(root) };
};

type Page = ReturnType<typeof mountApplication>["page"];

const press = (page: Page, name: string) => {
  fireEvent.click(page.getByRole("button", { name }));
};

const readLatestReport = (page: Page) =>
  within(page.getByRole("region", { name: "Latest report" }));

const readOutcome = (page: Page, destination: string) =>
  readLatestReport(page).getByRole("listitem", { name: destination })
    .textContent;

const waitForSettled = (page: Page) =>
  waitFor(() => {
    expect(readLatestReport(page).getByText("Settled")).toBeTruthy();
  });

test("Ledger opens signed in as Ada, with nothing reported yet", () => {
  const { page } = mountApplication();

  expect(
    page
      .getByRole("button", { name: "Ada Lovelace" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(page.getByRole("list", { name: "Invoices" })).toBeTruthy();
  expect(readLatestReport(page).getByText("Nothing reported yet")).toBeTruthy();
});

test("a payment reaches your API, Sentry and the console, and routing leaves PostHog out", async () => {
  const { page } = mountApplication();

  press(page, "Pay INV-1042");
  await waitForSettled(page);

  expect(readOutcome(page, "Your API")).toContain("Submitted");
  expect(readOutcome(page, "Your API")).toContain("backend-acknowledged");
  expect(readOutcome(page, "Sentry")).toContain("Submitted");
  expect(readOutcome(page, "Console")).toContain("Submitted");
  expect(readOutcome(page, "PostHog")).toContain("Not routed");
});

test("the boundary reports a broken preview with where Vue caught it, and reset brings it back", async () => {
  const { page, runtime } = mountApplication();

  press(page, "Break the preview");
  await nextTick();

  expect(page.getByRole("alert").textContent).toContain(
    "The preview crashed and was reported.",
  );
  await waitFor(() => {
    expect(readLatestReport(page).getByText("Render the preview")).toBeTruthy();
  });

  const [tracked] = runtime.receipts.getSnapshot();

  expect(runtime.findReport(tracked?.receipt.id ?? "")?.contexts.vue).toEqual({
    info: expect.stringContaining("render"),
  });

  press(page, "Reset the preview");
  await nextTick();

  expect(page.getByText("The preview is rendering normally.")).toBeTruthy();
});

test("an upload that outlives an account switch is dropped rather than charged to the next account", async () => {
  vi.useFakeTimers();

  const { page } = mountApplication();

  press(page, "Attach receipt.pdf");
  press(page, "Grace Hopper");
  await vi.advanceTimersByTimeAsync(3_100);

  const latest = page.getByRole("region", { name: "Latest report" });

  expect(latest.textContent).toContain("No destination got this report");
  expect(latest.textContent).toContain("stale-scope");
});

test("unmounting leaves the Flare to the page that started it", () => {
  const { runtime, unmount } = mountApplication();

  unmount();

  expect(runtime.flare.status.get().state).toBe("started");
});
