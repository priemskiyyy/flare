// Typechecked, never imported. Nothing is registered inside the package, so
// these lines pin the unregistered path: any Flare is accepted, and names stay
// open. The registered path is checked from outside the package, by the packed
// consumer, because a module augmentation here would retype every test.
import { Flare } from "@priemskiyyy/flare";
import type {
  DestinationStatus,
  Destinations,
  FlareSchema,
  FlareStatus,
  StandardSchema,
} from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { expectTypeOf } from "vitest";
import { shallowRef } from "vue";

import type { FlareErrorBoundaryProps } from "src/components/FlareErrorBoundary";
import { useDestinationStatus } from "src/composables/useDestinationStatus";
import { useFlare } from "src/composables/useFlare";
import { useFlareStatus } from "src/composables/useFlareStatus";
import type { FlareProviderProps } from "src/context/FlareProvider";
import type {
  RegisteredDestinationName,
  RegisteredDestinations,
  RegisteredSchema,
} from "src/types/Register";

declare const schemaOf: <TValue>() => StandardSchema<TValue>;

const typed = new Flare({
  destinations: { sentry: createMockAdapter().adapter },
  schema: { tags: { area: schemaOf<"upload" | "editor">() } },
});

const untyped = new Flare({
  destinations: { sentry: createMockAdapter().adapter },
});

// A Flare typed with its own destinations and schema is accepted by the
// provider without registering anything, which keeps the untyped path usable.
expectTypeOf(typed).toExtend<FlareProviderProps["flare"]>();
expectTypeOf(untyped).toExtend<FlareProviderProps["flare"]>();

export const useTypeContracts = () => {
  expectTypeOf<RegisteredDestinations>().toEqualTypeOf<Destinations>();
  expectTypeOf<RegisteredSchema>().toEqualTypeOf<FlareSchema>();
  expectTypeOf<RegisteredDestinationName>().toEqualTypeOf<string>();

  expectTypeOf(useFlare().value).toEqualTypeOf<
    Flare<Destinations, FlareSchema>
  >();
  expectTypeOf(useFlareStatus().value).toEqualTypeOf<FlareStatus>();
  expectTypeOf(
    useDestinationStatus("anything").value,
  ).toEqualTypeOf<DestinationStatus>();
  // The name may be reactive.
  useDestinationStatus(() => "anything");
  useDestinationStatus(shallowRef("anything"));

  const status = useFlareStatus();

  // @ts-expect-error -- a status is read, never written.
  status.value = { state: "started" };

  // @ts-expect-error -- a destination is named by a string.
  useDestinationStatus(7);
};

// Every boundary prop is optional: the fallback is a slot.
expectTypeOf<Record<string, never>>().toExtend<FlareErrorBoundaryProps>();

export const withBadLevel: FlareErrorBoundaryProps = {
  // @ts-expect-error -- a level is one of four words.
  capture: { level: "catastrophic" },
};
