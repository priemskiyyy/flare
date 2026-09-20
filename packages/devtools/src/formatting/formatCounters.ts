import type { FlareSnapshot } from "@priemskiyyy/flare";

export const formatCounters = ({
  generation,
  breadcrumbs,
  pendingReceipts,
}: Pick<FlareSnapshot, "generation" | "breadcrumbs" | "pendingReceipts">) =>
  `identity #${generation} · ${breadcrumbs} ${breadcrumbs === 1 ? "breadcrumb" : "breadcrumbs"} · ${pendingReceipts} pending`;
