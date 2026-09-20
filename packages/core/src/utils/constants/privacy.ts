import type { RedactRule } from "src/types/RedactRule";

export const REDACTED = "[Redacted]";

export const DEFAULT_REDACT: RedactRule[] = [
  /token|authorization|password|secret|cookie|api[-_]?key/i,
];
