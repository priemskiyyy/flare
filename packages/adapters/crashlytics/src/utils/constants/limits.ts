/** Crashlytics keeps at most 64 custom keys. A blanked key still holds its slot. */
export const MAX_KEYS = 64;

/** Crashlytics cuts a key's value, and a log line, at about 1 kB. */
export const MAX_VALUE_LENGTH = 1_024;
