import { createApp } from "vue";

import { startLedger } from "examples/shared/ledger/utils/startLedger";
import Application from "src/Application.vue";
import "src/style.css";

const { providers, runtime } = startLedger({ latency: 400 });

createApp(Application, { providers, runtime }).mount("#root");
