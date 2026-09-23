// Typechecked, never imported: these assignments fail compilation if the real
// Datadog React Native SDK stops satisfying the structural type the adapter
// is written against, or if the injected SDK stops flowing into the native
// handle.
import { datadogRum } from "@datadog/browser-rum";
import { DdRum } from "@datadog/mobile-react-native";
import { Flare } from "@priemskiyyy/flare";

import { datadog } from "src/datadog";
import type { DdRumLike } from "src/types/DdRumLike";

export const sdk: DdRumLike = DdRum;

export const flare = new Flare({
  destinations: { datadog: datadog({ sdk: DdRum }) },
});

// The native handle is the real SDK, with everything Flare does not wrap.
export const addAction = flare.destination("datadog").native?.addAction;

// @ts-expect-error -- the browser SDK has its own package.
datadog({ sdk: datadogRum });
