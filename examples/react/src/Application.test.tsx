import { FlareProvider } from "@priemskiyyy/flare-react";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Application } from "src/Application";
import { createExampleBackend } from "src/backend/createExampleBackend";
import { createExampleFlare } from "src/reporting/createExampleFlare";

let backend: ReturnType<typeof createExampleBackend>;
let flare: ReturnType<typeof createExampleFlare>;

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  backend = createExampleBackend();
  flare = createExampleFlare({ fetch: backend.fetch });
  flare.start();
});

afterEach(() => {
  cleanup();
  flare.dispose();
  vi.useRealTimers();
});

const renderApplication = () =>
  render(
    <FlareProvider flare={flare}>
      <Application backend={backend} />
    </FlareProvider>,
  );

const press = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

const readReceipt = () => screen.getByLabelText("Last receipt").textContent;

test("a payment error reaches the backend redacted, under the signed-in user, and the receipt says so", async () => {
  renderApplication();

  press("Sign in as Ada");
  press("Report payment failure");

  await waitFor(() => {
    expect(readReceipt()).toContain("backend-acknowledged");
  });
  expect(backend.report.get()?.body).toMatchObject({
    contexts: { payment: { cardToken: "[Redacted]", amount: 42 } },
    identity: expect.objectContaining({ user: { id: "u_1", name: "Ada" } }),
    tags: { area: "checkout" },
  });
});

test("a render error is reported by the boundary, and the fallback can reset", async () => {
  renderApplication();

  press("Break the widget");

  expect(screen.getByRole("alert").textContent).toContain("reported");
  await waitFor(() => {
    expect(readReceipt()).toContain("backend-acknowledged");
  });

  press("Reset widget");
  expect(
    screen.getByText("The widget is rendering normally.").textContent,
  ).toBe("The widget is rendering normally.");
});

test("an upload that outlives an account switch is dropped instead of blaming the new account", async () => {
  vi.useFakeTimers();
  renderApplication();

  press("Sign in as Ada");
  press("Start upload");
  press("Sign in as Grace");
  await act(() => vi.advanceTimersByTimeAsync(3100));
  vi.useRealTimers();

  await waitFor(() => {
    expect(readReceipt()).toContain("stale-scope");
  });
});

test("an upload shows its pending state and cannot be started twice", () => {
  vi.useFakeTimers();
  renderApplication();

  press("Start upload");

  expect(screen.getByRole("status").textContent).toContain(
    "Uploading avatar.png",
  );
  expect(
    screen.getByRole("button", { name: /upload/i }).hasAttribute("disabled"),
  ).toBe(true);
});

test("the sanitized payload is inspectable without opening the browser console", async () => {
  renderApplication();

  press("Report payment failure");

  const payload = await screen.findByLabelText("Sanitized payload");

  expect(payload.textContent).toContain("[Redacted]");
  expect(payload.textContent).not.toContain("tok_live_123");
});

test("unmounting cancels an unfinished upload before it reports", async () => {
  vi.useFakeTimers();

  const events: string[] = [];

  const stop = flare.diagnostics.events.subscribe((event) =>
    events.push(event.type),
  );

  const application = renderApplication();

  press("Start upload");

  application.unmount();
  await vi.advanceTimersByTimeAsync(3100);

  expect(events).not.toContain("report accepted");
  stop();
});
