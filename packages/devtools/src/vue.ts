import { FlareDevtools as Devtools } from "@priemskiyyy/flare-devtools";
import type { FlareDevtoolsOptions } from "@priemskiyyy/flare-devtools";
import { useFlare } from "@priemskiyyy/flare-vue";
import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  watch,
} from "vue";

export type FlareDevtoolsProps = Omit<FlareDevtoolsOptions, "flare">;

/**
 * Mounts the inspector for the nearest `FlareProvider`. Renders an empty host
 * element on the server and follows the provider's Flare after mount.
 *
 * @example
 * ```vue
 * <FlareProvider :flare="flare">
 *   <Application />
 *   <FlareDevtools v-if="isDevelopment" />
 * </FlareProvider>
 * ```
 */
export const FlareDevtools = defineComponent(
  (props: FlareDevtoolsProps) => {
    const flare = useFlare();
    const host = shallowRef<HTMLDivElement | null>(null);

    const devtools = new Devtools({
      flare: flare.value,
      initialIsOpen: props.initialIsOpen ?? false,
      maxEvents: props.maxEvents ?? 200,
    });

    watch(flare, (current) => devtools.setFlare(current));
    watch(
      () => props.maxEvents ?? 200,
      (maxEvents) => devtools.setMaxEvents(maxEvents),
    );
    onMounted(() => {
      const element = host.value;

      if (element === null) {
        return;
      }

      devtools.mount(element);
    });
    onUnmounted(devtools.unmount);

    return () => h("div", { ref: host, "data-flare-devtools": "" });
  },
  { name: "FlareDevtools", props: ["initialIsOpen", "maxEvents"] },
);
