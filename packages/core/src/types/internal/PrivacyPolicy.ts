import type { FlareLimits } from "src/types/FlareLimits";
import type { RedactRule } from "src/types/RedactRule";

/** The resolved privacy options every sanitizing step reads. */
export type PrivacyPolicy = {
  redact: RedactRule[];
  scrub: ((text: string, path: string) => string) | null;
  limits: FlareLimits;
};
