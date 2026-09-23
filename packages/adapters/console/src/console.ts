import type { ReporterAdapter } from "@priemskiyyy/flare";

import { formatReportLine } from "src/formatting/formatReportLine";
import type { ConsoleAdapterOptions } from "src/types/ConsoleAdapterOptions";
import type { ConsoleWriter } from "src/types/ConsoleWriter";
import { assertUnreachable } from "src/utils/assertUnreachable";

// The global console is read on every write, so a console replaced after the
// destination opened, such as a test spy, is the one written to.
const writeToConsole: ConsoleWriter = ({ level, line, report }) => {
  if (level === "fatal" || level === "error") {
    globalThis.console.error(line, report);

    return;
  }

  if (level === "warning") {
    globalThis.console.warn(line, report);

    return;
  }

  if (level === "info") {
    globalThis.console.info(line, report);

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
 * const flare = new Flare({ destinations: { console: console() } });
 * ```
 */
export const console = ({
  writer = writeToConsole,
}: ConsoleAdapterOptions = {}): ReporterAdapter<ConsoleWriter> => ({
  name: "console",
  open: () => ({
    native: writer,
    submit: async (report) => {
      await writer({
        level: report.level,
        line: formatReportLine(report),
        report,
      });

      return { status: "submitted", evidence: "sdk-call-returned" };
    },
  }),
});
