// Typechecked, never imported: these lines fail compilation if destination
// names, native handles or the schema stop flowing into the public API.
import { z } from "zod";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { MockSession } from "src/mock/createMockAdapter";
import type { FlareSchema } from "src/types/FlareSchema";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { StandardSchema } from "src/types/StandardSchema";
import { Flare } from "src/utils/Flare";

declare const schemaOf: <TValue>() => StandardSchema<TValue>;
declare const sdkAdapter: ReporterAdapter<{ sdkVersion: string }>;

const schema = {
  tags: { area: schemaOf<"upload" | "editor">() },
  contexts: { upload: schemaOf<{ attempt: number }>() },
  breadcrumbs: { uploadStarted: schemaOf<{ kind: "avatar" }>() },
} satisfies FlareSchema;

export const typed = new Flare({
  destinations: { sdk: sdkAdapter, mock: createMockAdapter().adapter },
  schema,
  defaults: { to: ["sdk"], tags: { area: "upload" } },
});

// Destination names flow into routing, receipts and handles.
typed.capture(new Error("typed"), { to: ["mock", "sdk"] });
export const outcome = typed.capture(new Error("typed")).status.get();

if (outcome.state === "settled") {
  outcome.outcomes.sdk?.status satisfies string | undefined;
}

typed.flush().then((result) => result.destinations.mock?.status);

// @ts-expect-error -- "sentry" is not a registered destination.
typed.capture(new Error("typed"), { to: ["sentry"] });

// @ts-expect-error -- "sentry" is not a registered destination.
typed.destination("sentry");

export const badRoute = new Flare({
  destinations: { sdk: sdkAdapter },
  defaults: {
    // @ts-expect-error -- defaults.to names only registered destinations.
    to: ["other"],
  },
});

export const badRouteFunction = new Flare({
  destinations: { sdk: sdkAdapter },
  defaults: {
    // @ts-expect-error -- so does a defaults.to function.
    to: () => ["other"],
  },
});

// Native handles are typed per destination.
export const sdkVersion: string | undefined =
  typed.destination("sdk").native?.sdkVersion;
export const mockSession: MockSession | null = typed.destination("mock").native;

export const wrongNative =
  // @ts-expect-error -- the mock's native handle has no sdkVersion.
  typed.destination("mock").native?.sdkVersion;

// The schema types tags, contexts and breadcrumbs everywhere they are accepted.
typed.tag("area", "editor");
typed.tag("area", null);
typed.context("upload", { attempt: 1 });
typed.breadcrumb("uploadStarted", { kind: "avatar" });
typed.scope({ tags: { area: "upload" }, contexts: { upload: { attempt: 2 } } });
typed.capture(new Error("typed"), { tags: { area: "upload" } });

// @ts-expect-error -- "billing" is not a declared area.
typed.tag("area", "billing");

// @ts-expect-error -- "plan" is not a declared tag.
typed.tag("plan", "pro");

// @ts-expect-error -- attempt must be a number.
typed.context("upload", { attempt: "1" });

// @ts-expect-error -- "clicked" is not a declared breadcrumb.
typed.breadcrumb("clicked");

// @ts-expect-error -- "billing" is not a declared area.
typed.capture(new Error("typed"), { tags: { area: "billing" } });

// @ts-expect-error -- a level is one of fatal, error, warning, info.
typed.message("note", { level: "debug" });

// Without a schema, untyped mode stays first class.
export const untyped = new Flare({ destinations: { sdk: sdkAdapter } });
untyped.tag("anything", 1);
untyped.context("any", { thing: true });
untyped.breadcrumb("clicked");
untyped.breadcrumb("clicked", { button: "save" });

// @ts-expect-error -- a tag is scalar even without a schema.
untyped.tag("nested", { no: true });

// A reusable list is input, so callers need not make a mutable copy.
const primaryRoute: readonly ["sdk"] = ["sdk"];

export const routed = new Flare({
  destinations: { sdk: sdkAdapter },
  defaults: { to: primaryRoute },
});
routed.capture(new Error("routed"), { to: primaryRoute });
export const selected = new Flare({
  destinations: { sdk: sdkAdapter },
  defaults: { to: () => primaryRoute },
});

// Callers supply schema input; only validated output reaches an adapter.
export const transformed = new Flare({
  destinations: { sdk: sdkAdapter },
  schema: {
    tags: { attempt: z.string().transform(Number) },
    contexts: { upload: z.string().transform((id) => ({ id })) },
    breadcrumbs: {
      started: z.object({ attempt: z.string().transform(Number) }),
      opened: z.object({ page: z.string() }).default({ page: "home" }),
    },
  },
  defaults: { tags: { attempt: "1" }, contexts: { upload: "avatar" } },
});
transformed.tag("attempt", "2");
transformed.context("upload", "avatar");
transformed.breadcrumb("started", { attempt: "3" });
transformed.breadcrumb("opened");
transformed.scope({ contexts: { upload: "avatar" } });
transformed.capture(new Error("transformed"), { tags: { attempt: "4" } });

// @ts-expect-error -- a transformed tag still takes its string input.
transformed.tag("attempt", 2);
// @ts-expect-error -- a transformed context still takes its string input.
transformed.context("upload", { id: "avatar" });
// @ts-expect-error -- declared breadcrumb data is required unless its schema accepts undefined.
transformed.breadcrumb("started");
