import type { FlareSnapshot } from "@priemskiyyy/flare";

const describeBreadcrumbs = (breadcrumbs: number) => {
  if (breadcrumbs === 1) {
    return "1 breadcrumb";
  }

  return `${breadcrumbs} breadcrumbs`;
};

export const formatCounters = ({
  generation,
  breadcrumbs,
  pendingReceipts,
}: Pick<FlareSnapshot, "generation" | "breadcrumbs" | "pendingReceipts">) =>
  `identity #${generation} · ${describeBreadcrumbs(breadcrumbs)} · ${pendingReceipts} pending`;
