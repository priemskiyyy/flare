export const DEFAULT_BUFFER = { capacity: 30, maxAge: 60_000 };
export const DEFAULT_TIMEOUT = 5_000;
export const DEFAULT_DEDUPE_WINDOW = 1_000;
export const DEFAULT_REPORTS_PER_MINUTE = 120;
export const DEFAULT_FLUSH_TIMEOUT = 2_000;

/** Explicit dedupe keys each destination remembers for the current identity. */
export const MAX_DEDUPE_KEYS = 100;

/** `setTimeout` overflows past 2^31 - 1 milliseconds and fires at once. */
export const MAX_TIMEOUT = 2_147_483_647;
