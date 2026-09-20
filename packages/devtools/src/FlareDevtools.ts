import { createComponent, createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { render } from "solid-js/web";

import { Devtools } from "src/components/Devtools";
import type { ObservedFlare } from "src/types/ObservedFlare";
import { EventLog } from "src/utils/EventLog";

export type FlareDevtoolsOptions = {
  /** The Flare to inspect. Only its `diagnostics` are ever read. */
  flare: ObservedFlare;
  /** Opens the panel on the first visit. Later visits restore the last open state. */
  initialIsOpen?: boolean;
  /** Events kept in memory. Defaults to 200, clamped to 1 to 1000. */
  maxEvents?: number;
};

/**
 * Framework-independent inspector for one Flare. Mount it into any element:
 * the panel renders in a shadow root, so host styles never leak in or out.
 *
 * It reads `flare.diagnostics` and nothing else. It never starts Flare, opens
 * a destination or creates a report, and what it shows holds no report
 * content, because the diagnostics hold none. Recording runs while mounted,
 * also when collapsed. The wrappers under `@priemskiyyy/flare-devtools/react`
 * and its siblings read the Flare from their provider.
 *
 * @example
 * ```ts
 * const devtools = new FlareDevtools({ flare });
 * devtools.mount(document.body.appendChild(document.createElement("div")));
 * ```
 */
export class FlareDevtools {
  #flare: Accessor<ObservedFlare>;
  #setFlare: Setter<ObservedFlare>;
  #maxEvents: Accessor<number>;
  #setMaxEvents: Setter<number>;
  #initialIsOpen: boolean;
  #log: EventLog;
  #dispose: (() => void) | null = null;

  constructor({
    flare,
    initialIsOpen = false,
    maxEvents = 200,
  }: FlareDevtoolsOptions) {
    const [currentFlare, setFlare] = createSignal(flare);
    const [currentMaxEvents, setMaxEvents] = createSignal(maxEvents);
    this.#flare = currentFlare;
    this.#setFlare = setFlare;
    this.#maxEvents = currentMaxEvents;
    this.#setMaxEvents = setMaxEvents;
    this.#initialIsOpen = initialIsOpen;
    this.#log = new EventLog(maxEvents);
  }

  /** Renders into `element` through a shadow root and starts recording. Throws when already mounted. */
  mount = (element: HTMLElement) => {
    if (this.#dispose !== null) {
      throw new Error(
        "Flare devtools are already mounted. Call unmount() first.",
      );
    }

    const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    this.#dispose = render(
      () =>
        createComponent(Devtools, {
          flare: this.#flare,
          maxEvents: this.#maxEvents,
          initialIsOpen: this.#initialIsOpen,
          log: this.#log,
        }),
      root,
    );
  };

  /** Removes the panel and stops recording. Recorded events survive until the next mount. */
  unmount = () => {
    if (this.#dispose === null) {
      return;
    }

    this.#dispose();
    this.#dispose = null;
  };

  /** Points the inspector at another Flare, for example after its destinations changed. */
  setFlare = (flare: ObservedFlare) => {
    this.#setFlare(() => flare);
  };

  setMaxEvents = (maxEvents: number) => {
    this.#setMaxEvents(maxEvents);
  };
}
