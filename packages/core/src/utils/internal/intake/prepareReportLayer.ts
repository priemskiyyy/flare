import type { FlareLevel } from "src/types/FlareLevel";
import type { FlareSchema } from "src/types/FlareSchema";
import type { MappingLoss } from "src/types/MappingLoss";
import type { ReportOptions } from "src/types/ReportOptions";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { ReportLayer } from "src/types/internal/ReportLayer";
import { isRecord } from "src/utils/common/isRecord";
import { prepareContexts } from "src/utils/internal/intake/prepareContexts";
import { prepareTags } from "src/utils/internal/intake/prepareTags";
import { prepareUser } from "src/utils/internal/intake/prepareUser";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";

const LEVELS = {
  fatal: true,
  error: true,
  warning: true,
  info: true,
} satisfies Record<FlareLevel, true>;

const isLevel = (value: unknown): value is FlareLevel =>
  typeof value === "string" && Object.hasOwn(LEVELS, value);

const prepareOperation = (
  operation: unknown,
  policy: PrivacyPolicy,
  losses: MappingLoss[],
) => {
  if (operation === null) {
    return null;
  }
  if (typeof operation !== "string") {
    losses.push({ path: "operation", reason: "invalid" });
    return null;
  }
  const sanitized = sanitizeValue(operation, "operation", policy);
  losses.push(...sanitized.losses);
  return typeof sanitized.value === "string" ? sanitized.value : null;
};

/** Prepares one metadata layer. Invalid fields cost only themselves; a failing scrubber rejects the layer. */
export const prepareReportLayer = <TSchema extends FlareSchema>(
  options: ReportOptions<TSchema>,
  { schema, policy }: { schema: FlareSchema; policy: PrivacyPolicy },
): { layer: ReportLayer; losses: MappingLoss[] } => {
  // Validation can call application code, so read each option once beforehand.
  const { tags, contexts, user, operation, level } = options;
  const losses: MappingLoss[] = [];
  const layer: ReportLayer = {};

  if (isRecord(tags)) {
    const prepared = prepareTags(tags, schema.tags, policy);
    layer.tags = prepared.value;
    losses.push(...prepared.losses);
  }

  if (isRecord(contexts)) {
    const prepared = prepareContexts(contexts, schema.contexts, policy);
    layer.contexts = prepared.value;
    losses.push(...prepared.losses);
  }

  if (user !== undefined) {
    const prepared = prepareUser(user, policy);
    layer.user = prepared.user;
    losses.push(...prepared.losses);
  }

  if (operation !== undefined) {
    layer.operation = prepareOperation(operation, policy, losses);
  }

  if (level !== undefined && !isLevel(level)) {
    losses.push({ path: "level", reason: "invalid" });
    return { layer, losses };
  }
  if (level !== undefined) {
    layer.level = level;
  }

  return { layer, losses };
};
