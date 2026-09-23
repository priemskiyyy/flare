import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { FlareError } from "src/utils/FlareError";

const scrubText = (
  text: string,
  path: string,
  scrub: PrivacyPolicy["scrub"],
) => {
  if (scrub === null) {
    return text;
  }

  return scrub(text, path);
};

/** Scrubs before cutting, so a secret cannot escape its pattern by straddling the limit. */
export const sanitizeString = (
  text: string,
  {
    path,
    maxLength,
    scrub,
    losses,
  }: {
    path: string;
    maxLength: number;
    scrub: PrivacyPolicy["scrub"];
    losses: MappingLoss[];
  },
) => {
  const value = scrubText(text, path, scrub);

  if (typeof value !== "string") {
    throw new FlareError({
      code: "INVALID_CONFIGURATION",
      message: "The scrub option must return a string.",
    });
  }

  if (value.length <= maxLength) {
    return value;
  }

  losses.push({ path, reason: "truncated" });

  return value.slice(0, maxLength);
};
