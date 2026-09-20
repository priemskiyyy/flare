import type {
  AmbientReporterContext,
  AmbientSnapshot,
} from "@priemskiyyy/flare";

import type { CrashlyticsLike } from "src/types/CrashlyticsLike";
import type { CrashlyticsReporterOptions } from "src/types/CrashlyticsReporterOptions";
import { MAX_KEYS, MAX_VALUE_LENGTH } from "src/utils/constants/limits";

type Parts = NonNullable<CrashlyticsReporterOptions<unknown>["ambient"]>;

const cut = (value: string) => value.slice(0, MAX_VALUE_LENGTH);

// The data was sanitized by the core, so serializing it runs no application code.
const toKeyValue = (value: unknown) =>
  typeof value === "string" ? value : (JSON.stringify(value) ?? "");

const toKeys = (snapshot: AmbientSnapshot, parts: Parts) => {
  const keys: Record<string, string> = Object.create(null);
  if (parts.tags === true) {
    for (const [key, value] of Object.entries(snapshot.tags)) {
      keys[key] = String(value);
    }
  }
  if (parts.contexts === true) {
    for (const [name, context] of Object.entries(snapshot.contexts)) {
      for (const [key, value] of Object.entries(context)) {
        keys[`${name}.${key}`] = toKeyValue(value);
      }
    }
  }
  return keys;
};

/**
 * Mirrors the parts of Flare's session that were asked for into Crashlytics'
 * global state. Crashlytics cannot delete a key or clear the user id, so a
 * removal writes an empty string, and a blanked key keeps its slot among the
 * 64 that Crashlytics allows.
 */
export const createAmbientMirror = <TInstance>(
  sdk: CrashlyticsLike<TInstance>,
  instance: TInstance,
  parts: Parts,
) => {
  // Every distinct key ever written, because a slot is never given back.
  const written = new Set<string>();
  let holding = new Set<string>();
  let userId: string | null = null;

  // The native setters are asynchronous, and nothing here can act on a failure.
  const contain = (task: () => PromiseLike<unknown>) => {
    try {
      Promise.resolve(task()).catch(() => {});
    } catch {
      return;
    }
  };

  const mirrorUser = (next: string | null) => {
    if (next === userId) {
      return;
    }
    userId = next;
    contain(() => sdk.setUserId(instance, next ?? ""));
  };

  const mirrorKeys = (next: Record<string, string>) => {
    const payload: Record<string, string> = Object.create(null);
    for (const key of holding) {
      if (!Object.hasOwn(next, key)) {
        payload[key] = "";
      }
    }

    const admitted = new Set<string>();
    for (const [key, value] of Object.entries(next)) {
      if (!written.has(key) && written.size >= MAX_KEYS) {
        continue;
      }
      written.add(key);
      admitted.add(key);
      payload[key] = cut(value);
    }
    holding = admitted;

    if (Object.keys(payload).length === 0) {
      return;
    }
    contain(() => sdk.setAttributes(instance, payload));
  };

  const mirrorsKeys = parts.tags === true || parts.contexts === true;
  const mirrorsSession = parts.user === true || mirrorsKeys;
  const session: AmbientReporterContext["session"] = (snapshot) => {
    if (parts.user === true) {
      mirrorUser(snapshot.user?.id ?? null);
    }
    if (mirrorsKeys) {
      mirrorKeys(toKeys(snapshot, parts));
    }
  };

  const enabled = mirrorsSession || parts.breadcrumbs === true;
  const context: AmbientReporterContext | undefined = !enabled
    ? undefined
    : {
        ...(mirrorsSession ? { session } : {}),
        ...(parts.breadcrumbs !== true
          ? {}
          : {
              breadcrumb: ({ name, data }) => {
                const line =
                  data === null ? name : `${name} ${toKeyValue(data)}`;
                sdk.log(instance, cut(line));
              },
            }),
      };

  return {
    context,
    /** The user id Flare last wrote, or `null` when it wrote none or blanked it. */
    userId: () => userId,
    /** Blanks what was mirrored. Log lines stay: Crashlytics has no way to clear them. */
    clear: () => {
      mirrorUser(null);
      mirrorKeys({});
    },
  };
};
