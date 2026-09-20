import type { CaptureOptions, Receipt } from "@priemskiyyy/flare";
import { defineComponent, onErrorCaptured, shallowRef } from "vue";
import type { SetupContext, SlotsType, VNodeChild } from "vue";

import { useFlareContext } from "src/composables/internal/useFlareContext";
import type {
  RegisteredDestinationName,
  RegisteredSchema,
} from "src/types/Register";

export type FlareErrorBoundaryProps = {
  /** Options for the report the boundary makes, such as tags, a level or `to`. */
  capture?: CaptureOptions<RegisteredDestinationName, RegisteredSchema>;
  /** Told after the report is made. */
  onError?: (caught: {
    error: unknown;
    receipt: Receipt<RegisteredDestinationName>;
  }) => void;
};

type FlareErrorBoundarySlots = SlotsType<{
  default?: () => VNodeChild;
  /** What to render instead of the children. It receives the error and a reset. */
  fallback?: (props: { error: unknown; reset: () => void }) => VNodeChild;
}>;

/**
 * Reports an error Vue captured in the tree below it, and renders its
 * `fallback` slot. Where Vue caught it travels as the `vue` context; with a
 * typed schema, declare that context or it is dropped and recorded as a loss.
 *
 * Vue's capture is wider than React's: it also sees errors thrown by event
 * handlers, watchers and lifecycle hooks below the boundary. A captured error
 * stops here, so an application error handler does not report it again. It
 * does not see asynchronous code, or its own fallback, whose error goes to the
 * parent. On the server it reports too, but renders nothing in place of the
 * failed tree, because server rendering is a single pass.
 *
 * @example
 * ```vue
 * <FlareErrorBoundary :capture="{ tags: { area: 'cart' } }">
 *   <Cart />
 *   <template #fallback="{ reset }">
 *     <button @click="reset">Try again</button>
 *   </template>
 * </FlareErrorBoundary>
 * ```
 */
export const FlareErrorBoundary = defineComponent(
  (
    props: FlareErrorBoundaryProps,
    { slots }: SetupContext<Record<string, never>, FlareErrorBoundarySlots>,
  ) => {
    const flare = useFlareContext("FlareErrorBoundary");
    const caught = shallowRef<{ error: unknown } | null>(null);

    const handleReset = () => {
      caught.value = null;
    };

    onErrorCaptured((error, _instance, info) => {
      // The fallback failed too. That is the parent's to handle, as in React.
      if (caught.value !== null) {
        return true;
      }

      const { capture, onError } = props;
      const receipt = flare.value.capture(error, {
        ...capture,
        contexts: { ...capture?.contexts, vue: { info } },
      });
      caught.value = { error };

      if (typeof onError === "function") {
        onError({ error, receipt });
      }

      return false;
    });

    return () => {
      const current = caught.value;

      if (current === null) {
        return slots.default?.();
      }

      return slots.fallback?.({ error: current.error, reset: handleReset });
    };
  },
  { name: "FlareErrorBoundary", props: ["capture", "onError"] },
);
