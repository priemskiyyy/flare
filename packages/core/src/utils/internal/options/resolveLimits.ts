import type { FlareLimits } from "src/types/FlareLimits";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { resolveCount } from "src/utils/internal/options/resolveCount";

export const resolveLimits = (
  limits: Partial<FlareLimits> = {},
): FlareLimits => ({
  depth: resolveCount(
    "privacy.limits.depth",
    limits.depth,
    DEFAULT_LIMITS.depth,
  ),
  breadth: resolveCount(
    "privacy.limits.breadth",
    limits.breadth,
    DEFAULT_LIMITS.breadth,
  ),
  stringLength: resolveCount(
    "privacy.limits.stringLength",
    limits.stringLength,
    DEFAULT_LIMITS.stringLength,
  ),
  messageLength: resolveCount(
    "privacy.limits.messageLength",
    limits.messageLength,
    DEFAULT_LIMITS.messageLength,
  ),
  stackLength: resolveCount(
    "privacy.limits.stackLength",
    limits.stackLength,
    DEFAULT_LIMITS.stackLength,
  ),
  causeDepth: resolveCount(
    "privacy.limits.causeDepth",
    limits.causeDepth,
    DEFAULT_LIMITS.causeDepth,
  ),
  aggregatedErrors: resolveCount(
    "privacy.limits.aggregatedErrors",
    limits.aggregatedErrors,
    DEFAULT_LIMITS.aggregatedErrors,
  ),
  breadcrumbs: resolveCount(
    "privacy.limits.breadcrumbs",
    limits.breadcrumbs,
    DEFAULT_LIMITS.breadcrumbs,
  ),
  totalSize: resolveCount(
    "privacy.limits.totalSize",
    limits.totalSize,
    DEFAULT_LIMITS.totalSize,
  ),
});
