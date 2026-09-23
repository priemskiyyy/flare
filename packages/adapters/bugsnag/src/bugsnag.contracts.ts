// Typechecked, never imported: these assignments fail compilation if a real
// Bugsnag SDK stops satisfying the structural types the adapter is written
// against, or if the injected SDK stops flowing into the native handle.
import BugsnagBrowser, { Breadcrumb as BrowserBreadcrumb } from "@bugsnag/js";
import BugsnagReactNative, {
  Breadcrumb as ReactNativeBreadcrumb,
} from "@bugsnag/react-native";
import { Flare } from "@priemskiyyy/flare";

import { bugsnag } from "src/bugsnag";
import type { BugsnagBreadcrumbConstructorLike } from "src/types/BugsnagBreadcrumbConstructorLike";
import type { BugsnagLike } from "src/types/BugsnagLike";

export const browserSdk: BugsnagLike = BugsnagBrowser;
export const reactNativeSdk: BugsnagLike = BugsnagReactNative;
export const browserBreadcrumb: BugsnagBreadcrumbConstructorLike =
  BrowserBreadcrumb;
export const reactNativeBreadcrumb: BugsnagBreadcrumbConstructorLike =
  ReactNativeBreadcrumb;

export const flare = new Flare({
  destinations: {
    web: bugsnag({ sdk: BugsnagBrowser, Breadcrumb: BrowserBreadcrumb }),
    native: bugsnag({
      sdk: BugsnagReactNative,
      Breadcrumb: ReactNativeBreadcrumb,
      messages: "as-error",
      ambient: { user: true },
    }),
  },
});

// The native handle is the real SDK, with everything Flare does not wrap.
export const session = flare.destination("web").native?.startSession;
export const featureFlag = flare.destination("native").native?.addFeatureFlag;

// @ts-expect-error -- a report's breadcrumbs need Bugsnag's Breadcrumb class.
bugsnag({ sdk: BugsnagBrowser });

// @ts-expect-error -- an object that is not the Bugsnag API is refused.
bugsnag({ sdk: { notify: () => {} }, Breadcrumb: BrowserBreadcrumb });
