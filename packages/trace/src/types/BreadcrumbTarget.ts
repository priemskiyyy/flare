import type { BreadcrumbOptions } from "@priemskiyyy/flare";

/**
 * The one method of a `Flare` the bridge calls.
 *
 * It is declared as a method on purpose. A method's parameters are compared
 * bivariantly, which is what lets a Flare whose schema types its breadcrumb
 * names be passed here. The bridge cannot know those names, so with a typed
 * schema Flare validates each breadcrumb at runtime, as it does for any caller.
 */
export type BreadcrumbTarget = {
  breadcrumb(
    name: string,
    data?: Record<string, unknown>,
    options?: BreadcrumbOptions,
  ): void;
};
