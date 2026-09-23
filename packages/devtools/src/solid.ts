import { FlareDevtools as Devtools } from "@priemskiyyy/flare-devtools";
import type { FlareDevtoolsOptions } from "@priemskiyyy/flare-devtools";
import { useFlare } from "@priemskiyyy/flare-solid";
import { createEffect, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";

export type FlareDevtoolsProps = Omit<FlareDevtoolsOptions, "flare">;

/**
 * Mounts the inspector for the nearest `FlareProvider`. Renders nothing on the
 * server and follows the provider's Flare after mount.
 *
 * @example
 * ```tsx
 * <FlareProvider flare={flare}>
 *   <Application />
 *   {import.meta.env.DEV ? <FlareDevtools /> : null}
 * </FlareProvider>
 * ```
 */
export const FlareDevtools = (props: FlareDevtoolsProps) => {
  if (isServer) {
    return null;
  }

  const flare = useFlare();

  const devtools = new Devtools({
    flare: flare(),
    initialIsOpen: props.initialIsOpen ?? false,
    maxEvents: props.maxEvents ?? 200,
  });

  const host = document.createElement("div");

  host.dataset.flareDevtools = "";

  createEffect(() => devtools.setFlare(flare()));
  createEffect(() => devtools.setMaxEvents(props.maxEvents ?? 200));
  onMount(() => devtools.mount(host));
  onCleanup(devtools.unmount);

  return host;
};
