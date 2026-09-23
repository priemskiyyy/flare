// Typechecked, never imported: these assignments fail compilation if the real
// React Native Firebase module stops satisfying the structural type the
// adapter is written against, or if its instance stops flowing into the
// native handle.
import { Flare } from "@priemskiyyy/flare";
import * as Crashlytics from "@react-native-firebase/crashlytics";

import { crashlytics } from "src/crashlytics";
import type { CrashlyticsLike } from "src/types/CrashlyticsLike";

export const sdk: CrashlyticsLike<Crashlytics.Crashlytics> = Crashlytics;

export const flare = new Flare({
  destinations: {
    crashlytics: crashlytics({
      sdk: Crashlytics,
      ambient: { user: true, tags: true, contexts: true, breadcrumbs: true },
    }),
  },
});

// The native handle is the real Crashlytics instance, for everything Flare
// does not wrap, such as opting a user into collection.
export const instance: Crashlytics.Crashlytics | null =
  flare.destination("crashlytics").native;

if (instance !== null) {
  Crashlytics.setCrashlyticsCollectionEnabled(instance, true).catch(() => {});
}

// @ts-expect-error -- an object that is not the Crashlytics module is refused.
crashlytics({ sdk: { recordError: () => {} } });
