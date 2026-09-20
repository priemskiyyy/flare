import { createReporterAdapter } from "@priemskiyyy/flare";
import type {
  ReporterCapabilities,
  SubmissionResult,
} from "@priemskiyyy/flare";

import { formatReportLine } from "src/formatting/formatReportLine";
import type { ConsoleReporterOptions } from "src/types/ConsoleReporterOptions";
import type { ConsoleWriter } from "src/types/ConsoleWriter";
import { assertUnreachable } from "src/utils/assertUnreachable";

const CAPABILITIES: ReporterCapabilities = {
  eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
  messages: true,
  evidence: "sdk-call-returned",
  flush: "none",
  queue: "none",
  automaticCapture: "none",
  instance: "instance",
  filtering: "none",
};

const hasConsole = () => {
  const target = globalThis.console;
  return (
    typeof target?.error === "function" &&
    typeof target?.warn === "function" &&
    typeof target?.info === "function"
  );
};

const writeToConsole: ConsoleWriter = ({ level, line, report }) => {
  // Read at submission time so replacement consoles retain their receiver.
  const target = globalThis.console;
  if (level === "fatal" || level === "error") {
    target.error(line, report);
    return;
  }
  if (level === "warning") {
    target.warn(line, report);
    return;
  }
  if (level === "info") {
    target.info(line, report);
    return;
  }
  assertUnreachable(level);
};

/**
 * A development destination that prints each report. It receives only what
 * every destination receives, so its output is already redacted. If the
 * console is instrumented to forward errors back into Flare, the core refuses
 * the capture made from inside the write, so no feedback loop can start.
 *
 * @example
 * ```ts
 * const flare = new Flare({ destinations: { console: consoleReporter() } });
 * ```
 */
export const consoleReporter = ({ writer }: ConsoleReporterOptions = {}) =>
  createReporterAdapter<ConsoleWriter>({
    name: "console",
    capabilities: CAPABILITIES,
    available: () => {
      if (typeof writer === "function" || hasConsole()) {
        return { available: true };
      }
      return {
        available: false,
        reason: "No console is available. Pass a writer to consoleReporter().",
      };
    },
    open: () => {
      const write = writer ?? writeToConsole;
      return {
        native: write,
        submit: (report) => {
          const written: unknown = write({
            level: report.level,
            line: formatReportLine(report),
            report,
          });
          const submitted: SubmissionResult = {
            status: "submitted",
            evidence: "sdk-call-returned",
          };
          if (written !== undefined) {
            return Promise.resolve(written).then(() => submitted);
          }
          return submitted;
        },
      };
    },
  });
