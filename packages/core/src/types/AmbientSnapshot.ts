import type { SessionSnapshot } from "src/types/SessionSnapshot";

/** The frozen, sanitized session state an ambient integration may mirror into provider globals. */
export type AmbientSnapshot = Omit<SessionSnapshot, "breadcrumbs">;
