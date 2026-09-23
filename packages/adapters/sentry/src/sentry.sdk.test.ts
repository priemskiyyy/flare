import { Flare } from "@priemskiyyy/flare";
import * as Sentry from "@sentry/browser";
import { afterEach, expect, test } from "vitest";

import { sentry } from "src/sentry";

afterEach(async () => {
  await Sentry.close();
  Sentry.getIsolationScope().clear();
  Sentry.getCurrentScope().clear();
});

test("the real SDK keeps a buffered report independent of the account mirrored at delivery", async () => {
  const events: Sentry.Event[] = [];

  Sentry.init({
    dsn: "https://key@example.test/1",
    defaultIntegrations: [],
    sendClientReports: false,
    beforeSend: (event) => {
      events.push(event);

      return null;
    },
  });
  Sentry.setContext("application", { build: 7 });

  const flare = new Flare({
    destinations: {
      sentry: sentry({
        sdk: Sentry,
        ambient: { user: true, tags: true, contexts: true, breadcrumbs: true },
      }),
    },
  });

  flare.user({ id: "ada" });
  flare.breadcrumb("ada-opened");

  const receipt = flare.message("captured under ada");

  flare.user({ id: "grace", email: "grace@example.test" });
  flare.tag("plan", "grace-plan");
  flare.context("workspace", { owner: "grace" });
  flare.start();
  await receipt.settled;
  await Sentry.flush(1_000);

  expect(events).toHaveLength(1);
  expect(events[0]?.user).toEqual({ id: "ada" });
  expect(events[0]?.contexts).toMatchObject({ application: { build: 7 } });
  expect(events[0]?.contexts).not.toHaveProperty("workspace");
  expect(events[0]?.tags).toEqual({ "flare.report_id": receipt.id });
  expect(events[0]?.breadcrumbs).toMatchObject([{ message: "ada-opened" }]);
  expect(JSON.stringify(events[0])).not.toContain("grace");
  flare.dispose();
});
