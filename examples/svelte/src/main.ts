import { mount } from "svelte";

import { startLedger } from "examples/shared/ledger/utils/startLedger";
import Application from "src/Application.svelte";
import "src/style.css";

const target = document.getElementById("root");

if (target === null) {
  throw new Error("The page has no #root element.");
}

const { providers, runtime } = startLedger({ latency: 400 });

mount(Application, { target, props: { providers, runtime } });
