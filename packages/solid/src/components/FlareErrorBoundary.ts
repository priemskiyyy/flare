import type { CaptureOptions, Receipt } from "@priemskiyyy/flare";
import { ErrorBoundary, createComponent } from "solid-js";
import type { JSX, ParentProps } from "solid-js";

import { useFlareContext } from "src/primitives/internal/useFlareContext";
import type {
  RegisteredDestinationName,
  RegisteredSchema,
} from "src/types/Register";

export type FlareErrorBoundaryProps = ParentProps<{
  /** What to render instead of the children, or a function that also receives the error and a reset. */
  fallback:
    | JSX.Element
    | ((props: { error: unknown; reset: () => void }) => JSX.Element);
  /** Options for the report the boundary makes, such as tags, a level or `to`. */
  capture?: CaptureOptions<RegisteredDestinationName, RegisteredSchema>;
  /** Told after the report is made. */
  onError?: (caught: {
    error: unknown;
    receipt: Receipt<RegisteredDestinationName>;
  }) => void;
}>;

/**
 * Reports an error caught by Solid's `ErrorBoundary` in the tree below it, and
 * renders a fallback. Solid has no component stack, so the report carries only
 * what `capture` gives it.
 *
 * Like every Solid error boundary it sees errors thrown while rendering and
 * inside reactive computations. It does not see errors in event handlers or in
 * asynchronous code outside a computation: report those with `flare().capture`.
 *
 * @example
 * ```tsx
 * <FlareErrorBoundary fallback={<p>Something went wrong.</p>} capture={{ tags: { area: "cart" } }}>
 *   <Cart />
 * </FlareErrorBoundary>
 * ```
 */
export const FlareErrorBoundary = (props: FlareErrorBoundaryProps) => {
  const flare = useFlareContext("FlareErrorBoundary");

  // Solid calls this once for each error it catches, which is when to report.
  // It calls it untracked, but only because it declares parameters: a fallback
  // function that declares none is rendered as a value instead.
  const handleError = (error: unknown, reset: () => void) => {
    const { capture, onError, fallback } = props;
    const receipt = flare().capture(error, capture);

    if (typeof onError === "function") {
      onError({ error, receipt });
    }

    if (typeof fallback !== "function") {
      return fallback;
    }

    return fallback({ error, reset });
  };

  return createComponent(ErrorBoundary, {
    fallback: handleError,
    get children() {
      return props.children;
    },
  });
};
