import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { startLedger } from "examples/shared/ledger/utils/startLedger";
import { Application } from "src/Application";
import "src/styles.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("The page has no #root element.");
}

const { backend, providers, runtime } = startLedger({ latency: 400 });

createRoot(root).render(
  <StrictMode>
    <Application backend={backend} providers={providers} runtime={runtime} />
  </StrictMode>,
);
