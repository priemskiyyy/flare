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
import type { Accessor } from "solid-js";
import { expectTypeOf } from "vitest";

import type { FlareErrorBoundaryProps } from "src/components/FlareErrorBoundary";
import type { FlareProviderProps } from "src/context/FlareProvider";
import { useDestinationStatus } from "src/primitives/useDestinationStatus";
import { useFlare } from "src/primitives/useFlare";
import { useFlareStatus } from "src/primitives/useFlareStatus";
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

  expectTypeOf(useFlare()).toEqualTypeOf<
    Accessor<Flare<Destinations, FlareSchema>>
  >();
  expectTypeOf(useFlareStatus()).toEqualTypeOf<Accessor<FlareStatus>>();
  expectTypeOf(useDestinationStatus("anything")).toEqualTypeOf<
    Accessor<DestinationStatus>
  >();
  // The name may be reactive.
  useDestinationStatus(() => "anything");

  // @ts-expect-error -- a destination is named by a string.
  useDestinationStatus(7);
};

expectTypeOf<{ fallback: null }>().toExtend<FlareErrorBoundaryProps>();

// @ts-expect-error -- a boundary needs a fallback.
export const withoutFallback: FlareErrorBoundaryProps = {};
