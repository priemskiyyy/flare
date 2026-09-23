/** Resolves after `duration`, or rejects with the signal's reason once it aborts. */
export const wait = (duration: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);

      return;
    }

    const handleAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, duration);

    signal.addEventListener("abort", handleAbort, { once: true });
  });
