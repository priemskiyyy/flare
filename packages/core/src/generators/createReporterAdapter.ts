import type { AmbientReporterContext } from "src/types/AmbientReporterContext";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { ReporterAdapterDefinition } from "src/types/ReporterAdapterDefinition";
import type { ReporterAvailability } from "src/types/ReporterAvailability";
import type { ReporterSession } from "src/types/ReporterSession";
import type { ReporterSessionDefinition } from "src/types/ReporterSessionDefinition";
import { captureError, combineErrors } from "src/utils/common/errors";
import { isPromiseLike } from "src/utils/common/isPromiseLike";

const describeProbeFailure = (error: unknown): ReporterAvailability => {
  if (error instanceof Error) {
    return { available: false, reason: error.message };
  }
  return { available: false, reason: "The availability probe threw." };
};

// An ambient call after disposal would write into a provider the session no longer owns.
const guardAmbient = (
  ambient: AmbientReporterContext,
  isDisposed: () => boolean,
): AmbientReporterContext => {
  const { session, breadcrumb } = ambient;
  const guarded: AmbientReporterContext = {};
  if (typeof session === "function") {
    guarded.session = (snapshot) => {
      if (isDisposed()) {
        return;
      }
      return session.call(ambient, snapshot);
    };
  }
  if (typeof breadcrumb === "function") {
    guarded.breadcrumb = (crumb) => {
      if (isDisposed()) {
        return;
      }
      return breadcrumb.call(ambient, crumb);
    };
  }
  return guarded;
};

/**
 * Builds a `ReporterAdapter` from provider mapping alone. It supplies
 * idempotent disposal, refusal of `submit` and `flush` after disposal, silent
 * ambient calls after disposal, rollback of everything registered on the
 * lifetime when `open` fails, and cleanup that attempts every step and
 * reports all failures together. Optional capabilities stay absent when the
 * session does not provide them.
 *
 * @example
 * ```ts
 * export const consoleReporter = () =>
 *   createReporterAdapter<Console>({
 *     name: "console",
 *     capabilities,
 *     open: () => ({ native: console, submit }),
 *   });
 * ```
 */
export const createReporterAdapter = <TNative>(
  definition: ReporterAdapterDefinition<TNative>,
): ReporterAdapter<TNative> => {
  const { name } = definition;

  const guard = (
    session: ReporterSessionDefinition<TNative>,
    release: () => unknown[],
  ): ReporterSession<TNative> => {
    let disposal: { result: void | Promise<void> } | null = null;
    const isDisposed = () => disposal !== null;
    const { flush, ambient } = session;
    const finishDisposal = (errors: unknown[]) => {
      const failures = [...errors, ...release()];
      if (failures.length > 0) {
        throw combineErrors(failures, `${name} cleanup failed.`);
      }
    };

    const guarded: ReporterSession<TNative> = {
      native: session.native,
      submit: (report, context) => {
        if (isDisposed()) {
          throw new Error(`Cannot submit through a disposed ${name} session.`);
        }
        return session.submit(report, context);
      },
      dispose: () => {
        if (disposal !== null) {
          return disposal.result;
        }

        disposal = { result: undefined };
        let pending: void | Promise<void> = undefined;
        const sessionErrors = captureError(() => {
          const { dispose } = session;
          if (typeof dispose === "function") {
            pending = dispose.call(session);
          }
        });

        if (pending === undefined) {
          finishDisposal(sessionErrors);
          return;
        }

        disposal.result = Promise.resolve(pending).then(
          () => finishDisposal([]),
          (error: unknown) => finishDisposal([error]),
        );
        return disposal.result;
      },
    };
    if (typeof flush === "function") {
      guarded.flush = (context) => {
        if (isDisposed()) {
          throw new Error(`Cannot flush a disposed ${name} session.`);
        }
        return flush.call(session, context);
      };
    }
    if (ambient !== undefined) {
      guarded.ambient = guardAmbient(ambient, isDisposed);
    }
    return guarded;
  };

  return {
    name,
    capabilities: definition.capabilities,
    ...(definition.singleton === undefined
      ? {}
      : { singleton: definition.singleton }),
    available: () => {
      try {
        if (typeof definition.available !== "function") {
          return { available: true };
        }
        return definition.available();
      } catch (error) {
        return describeProbeFailure(error);
      }
    },
    open: (context) => {
      const cleanups: Array<() => void> = [];
      // Emptying the list first makes every cleanup run at most once.
      const release = () => cleanups.splice(0).reverse().flatMap(captureError);
      const rollBack = (error: unknown): never => {
        throw combineErrors(
          [error, ...release()],
          `${name} setup and cleanup failed.`,
        );
      };

      try {
        const opened = definition.open(context, {
          add: (cleanup) => {
            cleanups.push(cleanup);
          },
        });
        if (isPromiseLike(opened)) {
          return Promise.resolve(opened)
            .then((session) => guard(session, release))
            .catch(rollBack);
        }
        return guard(opened, release);
      } catch (error) {
        return rollBack(error);
      }
    },
  };
};
