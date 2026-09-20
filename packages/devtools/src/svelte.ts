import { FlareDevtools as Devtools } from "@priemskiyyy/flare-devtools";
import type { FlareDevtoolsOptions } from "@priemskiyyy/flare-devtools";
import { useFlare } from "@priemskiyyy/flare-svelte";
import type { Attachment } from "svelte/attachments";

export type FlareDevtoolsProps = Omit<FlareDevtoolsOptions, "flare">;

/**
 * Creates an attachment that mounts the inspector for the nearest
 * `FlareProvider`. Call it during component initialisation and attach it to
 * any element; it remounts when the provider's Flare changes. An attachment
 * never runs on the server.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   const devtools = createDevtools();
 * </script>
 *
 * <div {@attach devtools}></div>
 * ```
 */
export const createDevtools = ({
  initialIsOpen = false,
  maxEvents = 200,
}: FlareDevtoolsProps = {}): Attachment<HTMLElement> => {
  const flare = useFlare();

  return (element) => {
    const devtools = new Devtools({
      flare: flare.current,
      initialIsOpen,
      maxEvents,
    });
    devtools.mount(element);
    return devtools.unmount;
  };
};
