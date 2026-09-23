import type { Breadcrumb } from "src/types/Breadcrumb";
import type { FlareUser } from "src/types/FlareUser";
import type { ObservableValue } from "src/types/ObservableValue";
import type { SessionSnapshot } from "src/types/SessionSnapshot";
import type { TagValue } from "src/types/TagValue";
import { ValueStore } from "src/utils/common/ValueStore";

const EMPTY: Omit<SessionSnapshot, "generation" | "user"> = {
  tags: Object.freeze({}),
  contexts: Object.freeze({}),
  breadcrumbs: Object.freeze([]),
};

/**
 * Owns what the current session contributes to a report. Every change
 * replaces the snapshot, so a report composed earlier can never be reached by
 * a later change. Inputs are expected to be sanitized and frozen already.
 */
export class SessionState {
  // The real id, never emitted: redaction must not be able to merge accounts.
  #identity: string | null = null;
  #maxBreadcrumbs: number;
  #state = new ValueStore<SessionSnapshot>(
    Object.freeze({ generation: 0, user: null, ...EMPTY }),
  );

  constructor({ maxBreadcrumbs }: { maxBreadcrumbs: number }) {
    this.#maxBreadcrumbs = maxBreadcrumbs;
  }

  state: ObservableValue<SessionSnapshot> = {
    get: this.#state.get,
    subscribe: this.#state.subscribe,
  };

  /** Sets the user and reports whether a new identity generation started. */
  identify = ({
    user,
    identity,
  }: {
    user: FlareUser | null;
    identity: string | null;
  }) => {
    const current = this.#state.get();

    if (identity !== this.#identity) {
      this.#identity = identity;
      this.#replace({ generation: current.generation + 1, user, ...EMPTY });

      return true;
    }

    if (
      user?.id === current.user?.id &&
      user?.email === current.user?.email &&
      user?.name === current.user?.name
    ) {
      return false;
    }

    this.#replace({ ...current, user });

    return false;
  };

  setTag = (key: string, value: TagValue) => {
    const current = this.#state.get();

    if (Object.is(current.tags[key], value)) {
      return;
    }

    this.#replace({
      ...current,
      tags: Object.freeze({ ...current.tags, [key]: value }),
    });
  };

  removeTag = (key: string) => {
    const current = this.#state.get();

    if (!Object.hasOwn(current.tags, key)) {
      return;
    }

    const tags = { ...current.tags };

    delete tags[key];
    this.#replace({ ...current, tags: Object.freeze(tags) });
  };

  setContext = (name: string, context: Record<string, unknown>) => {
    const current = this.#state.get();

    this.#replace({
      ...current,
      contexts: Object.freeze({ ...current.contexts, [name]: context }),
    });
  };

  removeContext = (name: string) => {
    const current = this.#state.get();

    if (!Object.hasOwn(current.contexts, name)) {
      return;
    }

    const contexts = { ...current.contexts };

    delete contexts[name];
    this.#replace({ ...current, contexts: Object.freeze(contexts) });
  };

  addBreadcrumb = (breadcrumb: Breadcrumb) => {
    if (this.#maxBreadcrumbs === 0) {
      return;
    }

    const current = this.#state.get();

    const breadcrumbs = [...current.breadcrumbs, breadcrumb].slice(
      -this.#maxBreadcrumbs,
    );

    this.#replace({ ...current, breadcrumbs: Object.freeze(breadcrumbs) });
  };

  #replace(next: SessionSnapshot) {
    this.#state.set(Object.freeze(next));
  }
}
