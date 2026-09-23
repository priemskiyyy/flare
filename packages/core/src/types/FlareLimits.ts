/**
 * Bounds applied to every report before it is retained or sent. Lengths are
 * in characters, and `totalSize` is the serialized size in characters.
 *
 * @example
 * ```ts
 * new Flare({ destinations, privacy: { limits: { breadcrumbs: 30 } } });
 * ```
 */
export type FlareLimits = {
  depth: number;
  breadth: number;
  stringLength: number;
  messageLength: number;
  stackLength: number;
  causeDepth: number;
  aggregatedErrors: number;
  breadcrumbs: number;
  totalSize: number;
};
