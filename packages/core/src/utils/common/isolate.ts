// Throw outside the notification chain so later listeners still run.
const reportUnhandledError = (error: unknown) => {
  queueMicrotask(() => {
    throw error;
  });
};

/** Runs one listener, so that its failure, thrown or rejected, reaches the host without stopping the others. */
export const isolate = (run: () => void) => {
  try {
    const result: unknown = run();

    if (result !== undefined) {
      Promise.resolve(result).catch(reportUnhandledError);
    }
  } catch (error) {
    reportUnhandledError(error);
  }
};
