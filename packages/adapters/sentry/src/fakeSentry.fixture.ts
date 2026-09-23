import type { SentryEventLike } from "src/types/SentryEventLike";

type ScopeData = {
  user: NonNullable<SentryEventLike["user"]> | null;
  level: NonNullable<SentryEventLike["level"]> | null;
  tags: NonNullable<SentryEventLike["tags"]>;
  contexts: NonNullable<SentryEventLike["contexts"]>;
  breadcrumbs: NonNullable<SentryEventLike["breadcrumbs"]>;
  transactionName: string | null;
};

type CapturedEvent =
  | { kind: "exception"; exception: unknown; scope: ScopeData }
  | { kind: "message"; message: string; scope: ScopeData };

const emptyScope = (): ScopeData => ({
  user: null,
  level: null,
  tags: {},
  contexts: {},
  breadcrumbs: [],
  transactionName: null,
});

const cloneScope = (scope: ScopeData): ScopeData => ({
  ...scope,
  tags: { ...scope.tags },
  contexts: { ...scope.contexts },
  breadcrumbs: [...scope.breadcrumbs],
});

/**
 * A synchronous SDK fixture for mapping tests. The installed SDK integration
 * test separately covers isolation and current scope composition. `global`
 * models the state available to provider-owned events. On `react-native`,
 * `withScope` swallows what its callback throws and answers `undefined`, as
 * `@sentry/react-native` does.
 */
export const fakeSentry = ({
  initialized = true,
  platform = "browser",
}: { initialized?: boolean; platform?: "browser" | "react-native" } = {}) => {
  const global = emptyScope();
  const stack: ScopeData[] = [global];

  const processors = new WeakMap<
    ScopeData,
    Array<(event: SentryEventLike) => SentryEventLike>
  >();

  const events: CapturedEvent[] = [];

  const calls: { init: number; flush: Array<number | undefined> } = {
    init: 0,
    flush: [],
  };

  const state: {
    initialized: boolean;
    flushAnswer: boolean;
    /** Makes `captureException` and `captureMessage` throw. */
    captureFailure: Error | null;
  } = { initialized, flushAnswer: true, captureFailure: null };

  const failIfAsked = () => {
    if (state.captureFailure !== null) {
      throw state.captureFailure;
    }
  };

  const current = () => stack[stack.length - 1] ?? global;

  const toEvent = (scope: ScopeData) => {
    const event: SentryEventLike = {
      tags: { ...scope.tags },
      contexts: { ...scope.contexts },
      breadcrumbs: [...scope.breadcrumbs],
    };

    if (scope.user !== null) {
      event.user = scope.user;
    }

    if (scope.level !== null) {
      event.level = scope.level;
    }

    if (scope.transactionName !== null) {
      event.transaction = scope.transactionName;
    }

    return event;
  };

  const captureScope = (): ScopeData => {
    const scope = current();
    let event = toEvent(scope);

    for (const processor of processors.get(scope) ?? []) {
      event = processor(event);
    }

    return {
      user: event.user ?? null,
      level: event.level ?? null,
      tags: event.tags ?? {},
      contexts: event.contexts ?? {},
      breadcrumbs: event.breadcrumbs ?? [],
      transactionName: event.transaction ?? null,
    };
  };

  const writer = (read: () => ScopeData) => ({
    addEventProcessor: (
      processor: (event: SentryEventLike) => SentryEventLike,
    ) => {
      const scope = read();

      processors.set(scope, [...(processors.get(scope) ?? []), processor]);
    },
    setUser: (user: ScopeData["user"]) => {
      read().user = user;
    },
    setLevel: (level: NonNullable<ScopeData["level"]>) => {
      read().level = level;
    },
    setTags: (tags: ScopeData["tags"]) => {
      Object.assign(read().tags, tags);
    },
    setContext: (name: string, context: Record<string, unknown> | null) => {
      if (context === null) {
        delete read().contexts[name];

        return;
      }

      read().contexts[name] = context;
    },
    setTransactionName: (name?: string) => {
      read().transactionName = name ?? null;
    },
    addBreadcrumb: (breadcrumb: ScopeData["breadcrumbs"][number]) => {
      read().breadcrumbs.push(breadcrumb);
    },
    clearBreadcrumbs: () => {
      read().breadcrumbs.length = 0;
    },
  });

  const sdk = {
    ...writer(() => global),
    withScope: <TResult>(
      callback: (scope: ReturnType<typeof writer>) => TResult,
    ) => {
      const forked = cloneScope(current());

      processors.set(forked, [...(processors.get(current()) ?? [])]);
      stack.push(forked);

      try {
        return callback(writer(() => forked));
      } catch (error) {
        if (platform === "react-native") {
          return undefined;
        }

        throw error;
      } finally {
        stack.pop();
      }
    },
    captureException: (exception: unknown) => {
      failIfAsked();
      events.push({
        kind: "exception",
        exception,
        scope: captureScope(),
      });

      return `evt_${events.length}`;
    },
    captureMessage: (message: string) => {
      failIfAsked();
      events.push({ kind: "message", message, scope: captureScope() });

      return `evt_${events.length}`;
    },
    flush: (timeout?: number) => {
      calls.flush.push(timeout);

      return Promise.resolve(state.flushAnswer);
    },
    getClient: () => {
      if (!state.initialized) {
        return undefined;
      }

      return { name: "fake client" };
    },
    getIsolationScope: () => writer(() => global),
  };

  return {
    sdk,
    events,
    global,
    calls,
    state,
    /** What an application's own `Sentry.init` does. */
    init: () => {
      calls.init += 1;
      state.initialized = true;
    },
  };
};
