import type {
  AmbientReporterContext,
  AmbientSnapshot,
} from "@priemskiyyy/flare";

import type { SentryAdapterOptions } from "src/types/SentryAdapterOptions";
import type { SentryLike } from "src/types/SentryLike";
import { getSentryBreadcrumb } from "src/utils/getSentryBreadcrumb";
import { getSentryUser } from "src/utils/getSentryUser";

type Parts = NonNullable<SentryAdapterOptions<SentryLike>["ambient"]>;

/**
 * Mirrors the parts of Flare's session that were asked for into Sentry's
 * global scope, and remembers what it wrote so it can take exactly that back.
 * Sentry's own breadcrumbs share the list Flare's are mirrored into, so an
 * account change clears that whole list.
 */
export const createAmbientMirror = (sdk: SentryLike, parts: Parts) => {
  const tags = new Set<string>();
  const contexts = new Set<string>();
  let generation: number | null = null;

  const mirrorTags = (next: AmbientSnapshot["tags"]) => {
    const removed: Record<string, undefined> = Object.create(null);

    for (const key of tags) {
      if (!Object.hasOwn(next, key)) {
        removed[key] = undefined;
        tags.delete(key);
      }
    }

    for (const key of Object.keys(next)) {
      tags.add(key);
    }

    sdk.setTags({ ...removed, ...next });
  };

  const mirrorContexts = (next: AmbientSnapshot["contexts"]) => {
    for (const name of contexts) {
      if (!Object.hasOwn(next, name)) {
        sdk.setContext(name, null);
        contexts.delete(name);
      }
    }

    for (const [name, context] of Object.entries(next)) {
      contexts.add(name);
      sdk.setContext(name, context);
    }
  };

  const ambient: AmbientReporterContext = {
    session: (snapshot) => {
      if (parts.user === true) {
        sdk.setUser(getSentryUser(snapshot.user));
      }

      if (parts.tags === true) {
        mirrorTags(snapshot.tags);
      }

      if (parts.contexts === true) {
        mirrorContexts(snapshot.contexts);
      }

      const changedAccount =
        generation !== null && generation !== snapshot.generation;

      generation = snapshot.generation;

      if (parts.breadcrumbs === true && changedAccount) {
        sdk.getIsolationScope().clearBreadcrumbs();
      }
    },
    breadcrumb: (breadcrumb) => {
      if (parts.breadcrumbs !== true) {
        return;
      }

      sdk.addBreadcrumb(getSentryBreadcrumb(breadcrumb));
    },
  };

  return {
    ambient,
    /**
     * The fields Flare must remove after Sentry composes its scopes. They
     * describe the current account, which may differ from the report's.
     */
    mirrored: () => ({ tags: [...tags], contexts: [...contexts] }),
    /** Takes back what was mirrored. Breadcrumbs stay: that list is not Flare's alone. */
    clear: () => {
      if (parts.user === true) {
        sdk.setUser(null);
      }

      if (parts.tags === true) {
        mirrorTags({});
      }

      if (parts.contexts === true) {
        mirrorContexts({});
      }
    },
  };
};
