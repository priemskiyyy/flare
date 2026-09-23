// Typechecked, never imported: these assignments fail compilation if the real
// Datadog RUM SDK stops satisfying the structural type the adapter is written
// against, or if the injected SDK stops flowing into the native handle.
import { datadogRum } from "@datadog/browser-rum";
import { DdRum } from "@datadog/mobile-react-native";
import { Flare } from "@priemskiyyy/flare";

import { datadog } from "src/datadog";
import type { DatadogRumLike } from "src/types/DatadogRumLike";

export const sdk: DatadogRumLike = datadogRum;

export const flare = new Flare({
  destinations: { datadog: datadog({ sdk: datadogRum }) },
});

// The native handle is the real SDK, with everything Flare does not wrap.
export const setUser = flare.destination("datadog").native?.setUser;

// @ts-expect-error -- an object that is not RUM is refused.
datadog({ sdk: { addError: () => {} } });

// @ts-expect-error -- the React Native SDK has its own package.
datadog({ sdk: DdRum });
