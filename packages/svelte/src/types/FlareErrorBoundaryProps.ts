import type { CaptureOptions, Receipt } from "@priemskiyyy/flare";
import type { Snippet } from "svelte";
import type {
  RegisteredDestinationName,
  RegisteredSchema,
} from "./Register.js";

// Optional props also accept `undefined`, so a parent can forward its own optional props.
export type FlareErrorBoundaryProps = {
  children?: Snippet | undefined;
  /** What to render instead of the children. It receives the error and a reset. */
  fallback?: Snippet<[{ error: unknown; reset: () => void }]> | undefined;
  /** Options for the report the boundary makes, such as tags, a level or `to`. */
  capture?:
    CaptureOptions<RegisteredDestinationName, RegisteredSchema> | undefined;
  /** Told after the report is made. */
  onError?:
    | ((caught: {
        error: unknown;
        receipt: Receipt<RegisteredDestinationName>;
      }) => void)
    | undefined;
};
