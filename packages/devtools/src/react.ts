import { FlareDevtools as Devtools } from "@priemskiyyy/flare-devtools";
import type { FlareDevtoolsOptions } from "@priemskiyyy/flare-devtools";
import { useFlare } from "@priemskiyyy/flare-react";
import { createElement, useEffect, useState } from "react";

export type FlareDevtoolsProps = Omit<FlareDevtoolsOptions, "flare">;

/**
 * Mounts the inspector for the nearest `FlareProvider`. Renders an empty host
 * element on the server and follows the provider's Flare after mount.
 *
 * @example
 * ```tsx
 * <FlareProvider flare={flare}>
 *   <Application />
 *   {import.meta.env.DEV ? <FlareDevtools /> : null}
 * </FlareProvider>
 * ```
 */
export const FlareDevtools = ({
  initialIsOpen = false,
  maxEvents = 200,
}: FlareDevtoolsProps) => {
  const flare = useFlare();

  const [devtools] = useState(
    () => new Devtools({ flare, initialIsOpen, maxEvents }),
  );

  useEffect(() => {
    devtools.setFlare(flare);
  }, [devtools, flare]);

  useEffect(() => {
    devtools.setMaxEvents(maxEvents);
  }, [devtools, maxEvents]);

  const handleHostRef = (element: HTMLDivElement | null) => {
    if (element === null) {
      return;
    }

    devtools.mount(element);

    return devtools.unmount;
  };

  return createElement("div", {
    ref: handleHostRef,
    "data-flare-devtools": "",
  });
};
