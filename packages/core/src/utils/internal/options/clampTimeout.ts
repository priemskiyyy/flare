import { MAX_TIMEOUT } from "src/utils/constants/defaults";

/** `flush` never throws, so a timeout it cannot keep is clamped instead of refused. */
export const clampTimeout = (timeout: number) => {
  if (Number.isNaN(timeout)) {
    return 0;
  }

  return Math.min(Math.max(timeout, 0), MAX_TIMEOUT);
};
