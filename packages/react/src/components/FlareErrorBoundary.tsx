import { FlareError } from "@priemskiyyy/flare";
import type { CaptureOptions, Receipt } from "@priemskiyyy/flare";
import { Component } from "react";
import type { ErrorInfo, PropsWithChildren, ReactNode } from "react";

import { FlareContext } from "src/context/FlareContext";
import type {
  RegisteredDestinationName,
  RegisteredSchema,
} from "src/types/Register";

type Caught = { error: unknown };

export type FlareErrorBoundaryProps = PropsWithChildren<{
  /** What to render instead of the children, or a function that also receives the error and a reset. */
  fallback:
    ReactNode | ((props: { error: unknown; reset: () => void }) => ReactNode);
  /** Options for the report the boundary makes, such as tags, a level or `to`. */
  capture?: CaptureOptions<RegisteredDestinationName, RegisteredSchema>;
  /** Told after the report is made. */
  onError?: (caught: {
    error: unknown;
    receipt: Receipt<RegisteredDestinationName>;
  }) => void;
}>;

/**
 * Reports an error thrown while rendering the tree below it, and renders a
 * fallback. The component stack travels as the `react` context; with a typed
 * schema, declare that context or it is dropped and recorded as a loss.
 *
 * Like every React error boundary it sees only errors thrown during
 * rendering, in lifecycle methods and in constructors. It does not see errors
 * in event handlers, in asynchronous code, during server rendering, or in the
 * boundary itself: report those with `flare.capture`.
 *
 * @example
 * ```tsx
 * <FlareErrorBoundary fallback={<p>Something went wrong.</p>} capture={{ tags: { area: "cart" } }}>
 *   <Cart />
 * </FlareErrorBoundary>
 * ```
 */
export class FlareErrorBoundary extends Component<
  FlareErrorBoundaryProps,
  { caught: Caught | null }
> {
  static override contextType = FlareContext;

  declare context: React.ContextType<typeof FlareContext>;

  override state: { caught: Caught | null } = { caught: null };

  static getDerivedStateFromError(error: unknown) {
    return { caught: { error } };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    const flare = this.context;

    if (flare === undefined) {
      return;
    }

    const { capture, onError } = this.props;

    const receipt = flare.capture(error, {
      ...capture,
      contexts: {
        ...capture?.contexts,
        react: { componentStack: info.componentStack ?? "" },
      },
    });

    if (typeof onError !== "function") {
      return;
    }

    onError({ error, receipt });
  }

  handleReset = () => {
    this.setState({ caught: null });
  };

  override render() {
    if (this.context === undefined) {
      throw new FlareError({
        code: "INVALID_CONFIGURATION",
        message: "FlareErrorBoundary must be used within a FlareProvider.",
      });
    }

    const { caught } = this.state;

    if (caught === null) {
      return this.props.children;
    }

    const { fallback } = this.props;

    if (typeof fallback !== "function") {
      return fallback;
    }

    return fallback({ error: caught.error, reset: this.handleReset });
  }
}
