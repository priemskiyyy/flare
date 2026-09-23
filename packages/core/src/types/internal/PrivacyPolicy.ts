import type { FlareLimits } from "src/types/FlareLimits";

/** The resolved privacy options every sanitizing step reads. */
export type PrivacyPolicy = {
  redact: (key: string, path: string) => boolean;
  scrub: ((text: string, path: string) => string) | null;
  limits: FlareLimits;
};
