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
 * A synchronous SDK fixture for mapping and ownership tests. The installed
 * SDK integration test separately covers isolation/current scope composition.
 * `global` models the state available to provider-owned events.
 */
export const fakeSentry = ({
  initialized = true,
}: { initialized?: boolean } = {}) => {
  const global = emptyScope();
  const stack: ScopeData[] = [global];

  const processors = new WeakMap<
    ScopeData,
    Array<(event: SentryEventLike) => SentryEventLike>
  >();

  const events: CapturedEvent[] = [];

  const calls: {
    init: number;
    close: number;
    flush: Array<number | undefined>;
  } = { init: 0, close: 0, flush: [] };

  const state = { initialized, flushAnswer: true };

  const current = () => stack[stack.length - 1] ?? global;

  const captureScope = (): ScopeData => {
    const scope = current();

    let event: SentryEventLike = {
      ...(scope.user === null ? {} : { user: scope.user }),
      ...(scope.level === null ? {} : { level: scope.level }),
      tags: { ...scope.tags },
      contexts: { ...scope.contexts },
      breadcrumbs: [...scope.breadcrumbs],
      ...(scope.transactionName === null
        ? {}
        : { transaction: scope.transactionName }),
    };

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
    withScope: (callback: (scope: ReturnType<typeof writer>) => void) => {
      const forked = cloneScope(current());

      processors.set(forked, [...(processors.get(current()) ?? [])]);
      stack.push(forked);

      try {
        callback(writer(() => forked));
      } finally {
        stack.pop();
      }
    },
    captureException: (exception: unknown) => {
      events.push({
        kind: "exception",
        exception,
        scope: captureScope(),
      });

      return `evt_${events.length}`;
    },
    captureMessage: (message: string) => {
      events.push({ kind: "message", message, scope: captureScope() });

      return `evt_${events.length}`;
    },
    flush: (timeout?: number) => {
      calls.flush.push(timeout);

      return Promise.resolve(state.flushAnswer);
    },
    close: () => {
      calls.close += 1;
      state.initialized = false;

      return Promise.resolve(true);
    },
    getClient: () => (state.initialized ? { name: "fake client" } : undefined),
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
