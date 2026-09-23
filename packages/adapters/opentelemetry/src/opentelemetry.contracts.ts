// Typechecked, never imported: these assignments fail compilation if a real
// OpenTelemetry logger stops satisfying the structural type the adapter is
// written against, or if the injected logger stops flowing into the native
// handle.
import { logs } from "@opentelemetry/api-logs";
import type { Logger } from "@opentelemetry/api-logs";
import { LoggerProvider } from "@opentelemetry/sdk-logs";
import { Flare } from "@priemskiyyy/flare";

import { opentelemetry } from "src/opentelemetry";
import type { OpenTelemetryLoggerLike } from "src/types/OpenTelemetryLoggerLike";

const provider = new LoggerProvider();

export const apiLogger: OpenTelemetryLoggerLike = logs.getLogger("app");
export const sdkLogger: OpenTelemetryLoggerLike = provider.getLogger("app");

export const flare = new Flare({
  destinations: {
    otel: opentelemetry({
      logger: provider.getLogger("app"),
      forceFlush: () => provider.forceFlush(),
    }),
  },
});

// The native handle is the real logger, with everything Flare does not wrap.
export const native: Logger | null = flare.destination("otel").native;

// @ts-expect-error -- an object that is not a logger is refused.
opentelemetry({ logger: { log: () => {} } });
