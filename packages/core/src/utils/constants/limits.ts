import type { FlareLimits } from "src/types/FlareLimits";

export const DEFAULT_LIMITS: FlareLimits = {
  depth: 6,
  breadth: 50,
  stringLength: 2_000,
  messageLength: 1_000,
  stackLength: 8_000,
  causeDepth: 5,
  aggregatedErrors: 5,
  breadcrumbs: 50,
  totalSize: 200_000,
};
