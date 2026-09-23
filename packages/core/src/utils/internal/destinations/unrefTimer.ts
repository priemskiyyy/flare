/**
 * Lets a Node process exit while a Flare timer is pending. Browsers and React
 * Native hand out numeric timer ids, which have nothing to unref.
 */
export const unrefTimer = (timer: ReturnType<typeof setTimeout>) => {
  if (typeof timer !== "object") {
    return;
  }

  if (typeof timer.unref !== "function") {
    return;
  }

  timer.unref();
};
