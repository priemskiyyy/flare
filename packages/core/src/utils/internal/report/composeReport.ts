import type { FlareLevel } from "src/types/FlareLevel";
import type { ReportLayer } from "src/types/internal/ReportLayer";
import type { ReportPayload } from "src/types/internal/ReportPayload";
import type { MappingLoss } from "src/types/MappingLoss";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SessionSnapshot } from "src/types/SessionSnapshot";

type Composition = {
  id: string;
  timestamp: number;
  payload: ReportPayload;
  defaults: ReportLayer;
  session: SessionSnapshot;
  scope: ReportLayer;
  options: ReportLayer;
  losses: readonly MappingLoss[];
};

const DEFAULT_LEVELS = {
  exception: "error",
  message: "info",
} satisfies Record<ReportPayload["kind"], FlareLevel>;

/**
 * Merges application defaults, the current session, an operation scope and
 * capture options, in that order, into one frozen report. Every input is
 * expected to be sanitized already; nothing here reads application objects.
 */
export const composeReport = ({
  id,
  timestamp,
  payload,
  defaults,
  session,
  scope,
  options,
  losses,
}: Composition): SanitizedReport => {
  // Prepared layers omit absent fields. An explicit null must still replace
  // the inherited user or operation, which object spread preserves.
  const metadata = { ...defaults, user: session.user, ...scope, ...options };

  return Object.freeze({
    ...payload,
    id,
    timestamp,
    level: metadata.level ?? DEFAULT_LEVELS[payload.kind],
    identity: Object.freeze({
      generation: session.generation,
      user: metadata.user,
    }),
    tags: Object.freeze({
      ...defaults.tags,
      ...session.tags,
      ...scope.tags,
      ...options.tags,
    }),
    contexts: Object.freeze({
      ...defaults.contexts,
      ...session.contexts,
      ...scope.contexts,
      ...options.contexts,
    }),
    breadcrumbs: session.breadcrumbs,
    operation: metadata.operation ?? null,
    losses: Object.freeze(losses.map((loss) => Object.freeze(loss))),
  });
};
