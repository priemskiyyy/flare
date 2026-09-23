import { FlareProvider } from "@priemskiyyy/flare-react";
import { registerRootComponent } from "expo";
import { AppState } from "react-native";

import { INITIAL_ACCOUNT } from "examples/shared/ledger/constants/accounts";
import { Application } from "src/Application";
import { flare } from "src/reporting/flare";
import { switchAccount } from "src/utils/switchAccount";

switchAccount(flare, INITIAL_ACCOUNT);
flare.start();

// A backgrounded app may be suspended at any moment: send what is queued.
AppState.addEventListener("change", (state) => {
  if (state !== "background") {
    return;
  }

  flare.flush({ timeout: 1_500 }).catch(() => {});
});

const Root = () => (
  <FlareProvider flare={flare}>
    <Application />
  </FlareProvider>
);

registerRootComponent(Root);
