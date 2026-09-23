import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { Breadcrumb } from "src/types/Breadcrumb";

/**
 * Mirrors Flare state into a provider's global context, so that reports the
 * provider captures on its own, such as native crashes, carry it. Isolation
 * here is weaker than in `submit`: globals are shared, and some providers
 * cannot clear a value once set. `submit` must never use this path.
 * Callback failures, including rejected promises, are recorded in diagnostics.
 *
 * @example
 * ```ts
 * ambient: {
 *   session: (snapshot) => sdk.setUser(snapshot.user),
 *   breadcrumb: (breadcrumb) => sdk.addBreadcrumb(breadcrumb.name),
 * }
 * ```
 */
export type AmbientReporterContext = {
  /** Called when the destination opens and whenever the user, tags or contexts change. */
  session: (snapshot: AmbientSnapshot) => void;
  /** Called for every breadcrumb recorded while the destination is open. */
  breadcrumb: (breadcrumb: Breadcrumb) => void;
};
