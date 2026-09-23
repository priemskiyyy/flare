import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const WIDTHS = [375, 1280];

const open = async (page: Page, width: number) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByText("Started", { exact: true }),
  ).toBeVisible();

  return errors;
};

const latestReport = (page: Page) =>
  page.getByRole("region", { name: "Latest report" });

const hasHorizontalScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

for (const width of WIDTHS) {
  test(`reports a payment without errors or horizontal scroll at ${width}px`, async ({
    page,
  }, testInfo) => {
    const errors = await open(page, width);

    await page.getByRole("button", { name: "Pay INV-1042" }).click();

    const latest = latestReport(page);

    await expect(latest.getByText("Settled", { exact: true })).toBeVisible();
    await expect(
      latest.getByRole("listitem", { name: "Your API" }),
    ).toContainText("Submitted");
    await expect(
      latest.getByRole("listitem", { name: "PostHog" }),
    ).toContainText("Not routed");
    await expect(hasHorizontalScroll(page)).resolves.toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(`ledger-${width}.png`),
      fullPage: true,
    });

    expect(errors).toEqual([]);
  });
}

test("a payment's payload shows the card token and the IBAN redacted", async ({
  page,
}) => {
  await open(page, 1280);
  await page.getByRole("button", { name: "Pay INV-1042" }).click();

  const latest = latestReport(page);

  await latest.getByText("What every destination received").click();

  const payload = latest.getByLabel("Sanitized payload");

  await expect(payload).toContainText('"cardToken": "[Redacted]"');
  await expect(payload).toContainText('"iban": "[Redacted]"');
  await expect(payload).not.toContainText("tok_live_4242");
  await expect(payload.locator("mark")).toHaveCount(2);
});

test("an upload that outlives an account switch is dropped as stale-scope", async ({
  page,
}) => {
  await open(page, 1280);
  await page.getByRole("button", { name: "Attach receipt.pdf" }).click();
  await page.getByRole("button", { name: "Grace Hopper" }).click();

  await expect(latestReport(page)).toContainText("stale-scope", {
    timeout: 6_000,
  });
});

test("Reset demo starts over, signed in as Ada with nothing reported", async ({
  page,
}) => {
  await open(page, 1280);
  await page.getByRole("button", { name: "Grace Hopper" }).click();
  await page.getByRole("button", { name: "Pay INV-2207" }).click();
  await expect(latestReport(page)).toContainText("Pay INV-2207");

  await page.getByRole("button", { name: "Reset demo" }).click();

  await expect(latestReport(page)).toContainText("Nothing reported yet");
  await expect(
    page.getByRole("button", { name: "Ada Lovelace" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the devtools open over the same runtime and list every destination", async ({
  page,
}) => {
  await open(page, 1280);
  await page.getByRole("button", { name: "Open Flare devtools" }).click();

  const destinations = page
    .getByRole("complementary", { name: "Flare devtools" })
    .getByRole("navigation", { name: "Flare destinations" });

  await expect(destinations).toBeVisible();

  for (const name of ["backend", "console", "sentry", "posthog", "datadog"]) {
    await expect(destinations).toContainText(name);
  }
});
