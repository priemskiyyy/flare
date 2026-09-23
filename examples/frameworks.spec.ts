import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const EXAMPLES = [
  { name: "Vue", url: "http://127.0.0.1:4391/" },
  { name: "Solid", url: "http://127.0.0.1:4392/" },
  { name: "Svelte", url: "http://127.0.0.1:4393/" },
];

const open = async (page: Page, url: string, width: number) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url);
  await expect(
    page.getByRole("banner").getByText("Started", { exact: true }),
  ).toBeVisible();

  return errors;
};

const latestReport = (page: Page) =>
  page.getByRole("region", { name: "Latest report" });

for (const { name, url } of EXAMPLES) {
  test(`${name} routes a payment and reports a broken preview`, async ({
    page,
  }) => {
    const errors = await open(page, url, 1280);
    const latest = latestReport(page);

    await page.getByRole("button", { name: "Pay INV-1042" }).click();
    await expect(latest.getByText("Settled", { exact: true })).toBeVisible();
    await expect(
      latest.getByRole("listitem", { name: "Your API" }),
    ).toContainText("Submitted");
    await expect(
      latest.getByRole("listitem", { name: "PostHog" }),
    ).toContainText("Not routed");

    await page.getByRole("button", { name: "Break the preview" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "The preview crashed and was reported.",
    );
    await expect(latest).toContainText("Render the preview");
    await expect(
      latest.getByRole("listitem", { name: "PostHog" }),
    ).toContainText("Submitted");
    expect(errors).toEqual([]);
  });

  test(`${name} drops an upload that outlives an account switch`, async ({
    page,
  }) => {
    await open(page, url, 1280);
    await page.getByRole("button", { name: "Attach receipt.pdf" }).click();
    await page.getByRole("button", { name: "Grace Hopper" }).click();

    await expect(latestReport(page)).toContainText("stale-scope", {
      timeout: 6_000,
    });
  });

  test(`${name} fits a phone without horizontal scroll`, async ({ page }) => {
    const errors = await open(page, url, 375);

    await page.getByRole("button", { name: "Pay INV-1042" }).click();
    await expect(
      latestReport(page).getByText("Settled", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });

  test(`${name} opens the devtools over the same runtime`, async ({ page }) => {
    await open(page, url, 1280);
    await page.getByRole("button", { name: "Open Flare devtools" }).click();

    const destinations = page
      .getByRole("complementary", { name: "Flare devtools" })
      .getByRole("navigation", { name: "Flare destinations" });

    for (const destination of ["backend", "sentry", "posthog"]) {
      await expect(destinations).toContainText(destination);
    }
  });
}
