/** What an adapter is told when its session opens. */
export type ReporterOpenContext = {
  /** The name this adapter was registered under in `destinations`. */
  destination: string;
};
