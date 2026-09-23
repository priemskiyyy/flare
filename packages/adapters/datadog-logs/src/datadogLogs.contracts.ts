// Typechecked, never imported: these assignments fail compilation if the real
// Datadog Logs SDK stops satisfying the structural type the adapter is written
// against, or if the injected SDK stops flowing into the native handle.
import { datadogLogs as browserLogs } from "@datadog/browser-logs";
import { datadogRum } from "@datadog/browser-rum";
import { Flare } from "@priemskiyyy/flare";

import { datadogLogs } from "src/datadogLogs";
import type { DatadogLogsLike } from "src/types/DatadogLogsLike";

export const sdk: DatadogLogsLike = browserLogs;

export const flare = new Flare({
  destinations: { logs: datadogLogs({ sdk: browserLogs }) },
});

// The native handle is the real SDK, with everything Flare does not wrap.
export const createLogger = flare.destination("logs").native?.createLogger;

// @ts-expect-error -- RUM is not the Logs SDK.
datadogLogs({ sdk: datadogRum });
