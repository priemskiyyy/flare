import type { ConsoleWriter } from "src/types/ConsoleWriter";

/**
 * Options for `consoleReporter()`.
 *
 * @example
 * ```ts
 * consoleReporter({ writer: ({ line }) => process.stderr.write(`${line}\n`) });
 * ```
 */
export type ConsoleReporterOptions = {
  /** Where reports go. Omitted, the global console is used, read when a report is written. */
  writer?: ConsoleWriter;
};
