/**
 * Something a report could not carry as given. The core records truncation
 * and schema rejections; an adapter records what its provider cannot express.
 * `path` names the field, for example `exception.stack` or `tags.area`.
 *
 * @example
 * ```ts
 * const loss: MappingLoss = { path: "breadcrumbs", reason: "unsupported" };
 * ```
 */
export type MappingLoss = {
  readonly path: string;
  readonly reason: "truncated" | "invalid" | "unsupported";
};
