import type { FlareLevel } from "src/types/FlareLevel";
import type { FlareSchema } from "src/types/FlareSchema";
import type { MappingLoss } from "src/types/MappingLoss";
import type { ReportOptions } from "src/types/ReportOptions";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { ReportLayer } from "src/types/internal/ReportLayer";
import { prepareContexts } from "src/utils/internal/intake/prepareContexts";
import { prepareTags } from "src/utils/internal/intake/prepareTags";
import { prepareUser } from "src/utils/internal/intake/prepareUser";
import { sanitizeString } from "src/utils/internal/privacy/sanitizeString";

const prepareOperation = (
  operation: string | null,
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

  return sanitizeString(operation, {
    path: "operation",
    maxLength: policy.limits.stringLength,
    scrub: policy.scrub,
    losses,
  });
};

const isFlareLevel = (level: unknown): level is FlareLevel =>
  level === "fatal" ||
  level === "error" ||
  level === "warning" ||
  level === "info";

/** Prepares one metadata layer. Invalid fields cost only themselves; a failing scrubber rejects the layer. */
export const prepareReportLayer = <TSchema extends FlareSchema>(
  options: ReportOptions<TSchema>,
  { schema, policy }: { schema: FlareSchema; policy: PrivacyPolicy },
): { layer: ReportLayer; losses: MappingLoss[] } => {
  // Validation can call application code, so read each option once beforehand.
  const { tags, contexts, user, operation, level } = options;
  const losses: MappingLoss[] = [];
  const layer: ReportLayer = {};

  if (tags !== undefined) {
    const prepared = prepareTags(tags, schema.tags, policy);

    layer.tags = prepared.value;
    losses.push(...prepared.losses);
  }

  if (contexts !== undefined) {
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

  if (level !== undefined && isFlareLevel(level)) {
    layer.level = level;
  }

  if (level !== undefined && !isFlareLevel(level)) {
    losses.push({ path: "level", reason: "invalid" });
  }

  return { layer, losses };
};
