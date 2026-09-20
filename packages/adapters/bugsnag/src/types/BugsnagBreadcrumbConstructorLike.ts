import type { BugsnagBreadcrumbLike } from "src/types/BugsnagBreadcrumbLike";

/**
 * Bugsnag's `Breadcrumb` class, which is a named export of `@bugsnag/js` and
 * `@bugsnag/react-native`. Its typed constructor takes no arguments, so the
 * reporter constructs it empty and assigns its fields. Plain objects would
 * not do: the class has the `toJSON` that spells Bugsnag's wire format.
 *
 * @example
 * ```ts
 * import Bugsnag, { Breadcrumb } from "@bugsnag/js";
 *
 * bugsnag({ sdk: Bugsnag, Breadcrumb });
 * ```
 */
export type BugsnagBreadcrumbConstructorLike = new () => BugsnagBreadcrumbLike;
