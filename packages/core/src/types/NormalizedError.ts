/** The safe, bounded part of one thrown value: never the value itself. */
export type NormalizedError = {
  readonly name: string;
  readonly message: string;
  readonly stack: string | null;
};
