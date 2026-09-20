type FakeUser = {
  id?: string | undefined;
  email?: string | undefined;
  name?: string | undefined;
};

/** Bugsnag's own class: constructed empty and serialized through `toJSON`, like the real one. */
class FakeBreadcrumb {
  message = "";
  metadata: Record<string, unknown> = {};
  type = "manual";
  timestamp = new Date(0);

  toJSON() {
    return {
      type: this.type,
      name: this.message,
      timestamp: this.timestamp,
      metaData: this.metadata,
    };
  }
}

type FakeEvent = {
  error: Error;
  severity: "info" | "warning" | "error";
  context?: string;
  breadcrumbs: FakeBreadcrumb[];
  user: FakeUser;
  metadata: Record<string, Record<string, unknown>>;
  setUser: (id?: string, email?: string, name?: string) => void;
  addMetadata: (section: string, values: Record<string, unknown>) => void;
  clearMetadata: (section: string) => void;
};

type OnError = (event: FakeEvent) => void | boolean;
type PostReport = (error: unknown, event: FakeEvent) => void;

const copyMetadata = (metadata: Record<string, Record<string, unknown>>) =>
  Object.fromEntries(
    Object.entries(metadata).map(([section, values]) => [
      section,
      { ...values },
    ]),
  );

/**
 * A Bugsnag SDK for the tests, modelled on the installed client: `notify`
 * builds an event from a copy of the client's user, metadata and breadcrumbs,
 * runs the `onError` callback against that copy, and calls back afterwards.
 * `client` is what events Bugsnag captures on its own would be sent with.
 */
export const fakeBugsnag = ({ started = true }: { started?: boolean } = {}) => {
  const client: {
    user: FakeUser;
    metadata: Record<string, Record<string, unknown>>;
    breadcrumbs: FakeBreadcrumb[];
  } = { user: {}, metadata: {}, breadcrumbs: [] };
  const events: FakeEvent[] = [];
  const state: {
    started: boolean;
    /** What delivery answers: `null` for delivered or enqueued, an error for a failure. */
    deliveryError: unknown;
    /** `false` models an application `onError` callback that discards the event. */
    applicationKeepsEvents: boolean;
    /** Holds the post-report callback until the test releases it. */
    hold: boolean;
    /** Models an asynchronous application hook before Flare's onError callback. */
    holdBeforeOnError: boolean;
  } = {
    started,
    deliveryError: null,
    applicationKeepsEvents: true,
    hold: false,
    holdBeforeOnError: false,
  };
  const held: Array<() => void> = [];
  const calls = { start: 0 };

  const sdk = {
    isStarted: () => state.started,
    notify: (error: Error, onError?: OnError, postReport?: PostReport) => {
      // The real static API only logs here, and never calls back.
      if (!state.started) {
        return;
      }

      const event: FakeEvent = {
        error,
        severity: "warning",
        breadcrumbs: client.breadcrumbs.slice(),
        user: { ...client.user },
        metadata: copyMetadata(client.metadata),
        setUser: (id, email, name) => {
          event.user = { id, email, name };
        },
        addMetadata: (section, values) => {
          event.metadata[section] = { ...event.metadata[section], ...values };
        },
        clearMetadata: (section) => {
          delete event.metadata[section];
        },
      };
      const finish = () => {
        // A discarded event still calls back without an error, exactly like delivery does.
        if (!state.applicationKeepsEvents) {
          postReport?.(null, event);
          return;
        }
        events.push(event);
        postReport?.(state.deliveryError, event);
      };
      const process = () => {
        let keep: boolean | void = undefined;
        try {
          keep = onError?.(event);
        } catch {
          // The real SDK logs callback failures and continues sending.
        }
        if (keep === false) {
          postReport?.(null, event);
          return;
        }
        if (state.hold) {
          held.push(finish);
          return;
        }
        finish();
      };
      if (state.holdBeforeOnError) {
        held.push(process);
        return;
      }
      process();
    },
    setUser: (id?: string, email?: string, name?: string) => {
      client.user = { id, email, name };
    },
    addMetadata: (section: string, values: Record<string, unknown>) => {
      client.metadata[section] = { ...client.metadata[section], ...values };
    },
    clearMetadata: (section: string, key?: string) => {
      if (key === undefined) {
        delete client.metadata[section];
        return;
      }
      delete client.metadata[section]?.[key];
    },
    leaveBreadcrumb: (
      message: string,
      metadata: Record<string, unknown> = {},
    ) => {
      const breadcrumb = new FakeBreadcrumb();
      breadcrumb.message = message;
      breadcrumb.metadata = metadata;
      breadcrumb.timestamp = new Date();
      client.breadcrumbs.push(breadcrumb);
    },
  };

  return {
    sdk,
    Breadcrumb: FakeBreadcrumb,
    client,
    events,
    state,
    calls,
    /** What an application's own `Bugsnag.start` does. */
    start: () => {
      calls.start += 1;
      state.started = true;
    },
    release: () => {
      for (const finish of held.splice(0)) {
        finish();
      }
    },
  };
};
