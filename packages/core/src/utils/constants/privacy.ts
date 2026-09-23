export const REDACTED = "[Redacted]";

/** Keys that name a credential, whatever their case or separator. */
export const SENSITIVE_KEY =
  /token|authorization|passw(?:or)?d|secret|cookie|credential|bearer|jwt|session[-_]?id|(?:api|access|private)[-_]?key/i;
