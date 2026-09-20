import { expect, test } from "vitest";

import { formatEventLocal } from "src/formatting/formatEventLocal";

test("event-local capabilities read as a list, or as nothing at all", () => {
  expect(
    formatEventLocal({
      user: true,
      tags: true,
      contexts: true,
      breadcrumbs: true,
    }),
  ).toBe("user, tags, contexts, breadcrumbs");
  expect(
    formatEventLocal({
      user: true,
      tags: false,
      contexts: true,
      breadcrumbs: false,
    }),
  ).toBe("user, contexts");
  expect(
    formatEventLocal({
      user: false,
      tags: false,
      contexts: false,
      breadcrumbs: false,
    }),
  ).toBe("nothing");
});
