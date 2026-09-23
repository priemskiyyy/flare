type EmittedRecord = {
  timestamp?: unknown;
  severityNumber?: number;
  severityText?: string;
  body?: unknown;
  attributes?: Record<string, unknown>;
};

/**
 * An OpenTelemetry logger for the tests. `emit` answers nothing and keeps the
 * record as the provider's processors would receive it; `forceFlush` settles
 * once the kept records are exported, or rejects as a failed export does.
 */
export const fakeLogger = () => {
  const emitted: EmittedRecord[] = [];
  const exported: EmittedRecord[] = [];
  const state: { flushFailure: Error | null } = { flushFailure: null };
  const calls = { emit: 0, forceFlush: 0 };

  const logger = {
    emit(logRecord: EmittedRecord) {
      calls.emit += 1;
      emitted.push(logRecord);
    },
  };

  const forceFlush = async () => {
    calls.forceFlush += 1;

    if (state.flushFailure !== null) {
      throw state.flushFailure;
    }

    exported.push(...emitted.splice(0));
  };

  return { logger, forceFlush, emitted, exported, state, calls };
};
