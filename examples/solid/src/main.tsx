import { render } from "solid-js/web";

import { startLedger } from "examples/shared/ledger/utils/startLedger";
import { Application } from "src/Application";
import "src/style.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("The page has no #root element.");
}

const { providers, runtime } = startLedger({ latency: 400 });

render(() => <Application runtime={runtime} providers={providers} />, root);
