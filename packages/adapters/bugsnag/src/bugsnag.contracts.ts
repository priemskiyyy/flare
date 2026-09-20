// Typechecked, never imported: these assignments fail compilation if a real
// Bugsnag SDK stops satisfying the structural types the reporter is written
// against, or if the injected SDK stops flowing into the native handle.
import BugsnagBrowser, { Breadcrumb as BrowserBreadcrumb } from "@bugsnag/js";
import BugsnagReactNative, {
  Breadcrumb as ReactNativeBreadcrumb,
} from "@bugsnag/react-native";
import { Flare } from "@priemskiyyy/flare";

import { bugsnag } from "src/bugsnag";
import { bugsnag as bugsnagReactNative } from "src/bugsnagReactNative";
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
    owned: bugsnag({
      sdk: BugsnagBrowser,
      ownership: "owned",
      start: () =>
        BugsnagBrowser.start({ apiKey: "0123456789abcdef0123456789abcdef" }),
    }),
    native: bugsnagReactNative({
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

// @ts-expect-error -- an owned SDK needs a start function.
bugsnag({ sdk: BugsnagBrowser, ownership: "owned" });

// @ts-expect-error -- a borrowed SDK is started by the application, not by Flare.
bugsnag({ sdk: BugsnagBrowser, ownership: "borrowed", start: () => {} });

// @ts-expect-error -- an object that is not the Bugsnag API is refused.
bugsnag({ sdk: { notify: () => {} } });
