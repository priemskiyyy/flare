import type {
  AmbientReporterContext,
  AmbientSnapshot,
} from "@priemskiyyy/flare";

import type { BugsnagLike } from "src/types/BugsnagLike";
import type { BugsnagReporterOptions } from "src/types/BugsnagReporterOptions";
import {
  GENERATION_KEY,
  RESERVED_SECTIONS,
  TAGS_SECTION,
} from "src/utils/constants/metadata";

type Parts = NonNullable<BugsnagReporterOptions<BugsnagLike>["ambient"]>;

/**
 * Mirrors the parts of Flare's session that were asked for into the Bugsnag
 * client, and remembers what it wrote so it can take exactly that back.
 * Breadcrumbs are the exception: Bugsnag has no way to remove one.
 */
export const createAmbientMirror = (sdk: BugsnagLike, parts: Parts) => {
  const tags = new Set<string>();
  const contexts = new Set<string>();
  let generation = 0;

  const mirrorTags = (next: AmbientSnapshot["tags"]) => {
    for (const key of tags) {
      if (!Object.hasOwn(next, key)) {
        sdk.clearMetadata(TAGS_SECTION, key);
        tags.delete(key);
      }
    }
    if (Object.keys(next).length === 0) {
      return;
    }
    for (const key of Object.keys(next)) {
      tags.add(key);
    }
    sdk.addMetadata(TAGS_SECTION, { ...next });
  };

  const mirrorContexts = (next: AmbientSnapshot["contexts"]) => {
    for (const name of contexts) {
      if (!Object.hasOwn(next, name)) {
        sdk.clearMetadata(name);
        contexts.delete(name);
      }
    }
    for (const [name, context] of Object.entries(next)) {
      if (RESERVED_SECTIONS.includes(name)) {
        continue;
      }
      contexts.add(name);
      // addMetadata merges into a section; a Flare context replaces by name.
      sdk.clearMetadata(name);
      sdk.addMetadata(name, { ...context });
    }
  };

  const enabled = Object.values(parts).includes(true);
  const context: AmbientReporterContext | undefined = !enabled
    ? undefined
    : {
        session: (snapshot) => {
          generation = snapshot.generation;
          if (parts.user === true) {
            const { user } = snapshot;
            sdk.setUser(user?.id, user?.email, user?.name);
          }
          if (parts.tags === true) {
            mirrorTags(snapshot.tags);
          }
          if (parts.contexts === true) {
            mirrorContexts(snapshot.contexts);
          }
        },
        ...(parts.breadcrumbs !== true
          ? {}
          : {
              breadcrumb: (breadcrumb) => {
                sdk.leaveBreadcrumb(
                  breadcrumb.name,
                  { ...breadcrumb.data, [GENERATION_KEY]: generation },
                  "manual",
                );
              },
            }),
      };

  return {
    context,
    /**
     * The metadata sections the mirror currently holds on the client. Bugsnag
     * copies the client onto every event, so a report must clear these before
     * it writes its own: they belong to the current account, which may not be
     * the account the report was captured under.
     */
    sections: () => [...(tags.size > 0 ? [TAGS_SECTION] : []), ...contexts],
    /** Takes back the user, tags and contexts that were mirrored. */
    clear: () => {
      if (parts.user === true) {
        sdk.setUser(undefined, undefined, undefined);
      }
      mirrorTags({});
      mirrorContexts({});
    },
  };
};
