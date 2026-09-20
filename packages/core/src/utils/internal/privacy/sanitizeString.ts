import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";

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
  const value = scrub === null ? text : scrub(text, path);
  if (typeof value !== "string") {
    throw new Error("The scrub option must return a string.");
  }
  if (value.length <= maxLength) {
    return value;
  }
  losses.push({ path, reason: "truncated" });
  return value.slice(0, maxLength);
};
