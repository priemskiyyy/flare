import type { ConsoleWriter } from "src/types/ConsoleWriter";

/**
 * Options for `console()`.
 *
 * @example
 * ```ts
 * console({ writer: ({ line }) => process.stderr.write(`${line}\n`) });
 * ```
 */
export type ConsoleAdapterOptions = {
  /** Where reports go. Omitted, the global console is used, read when a report is written. */
  writer?: ConsoleWriter;
};
