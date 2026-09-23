import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Application } from "src/Application";
import { startLedger } from "src/utils/startLedger";
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
