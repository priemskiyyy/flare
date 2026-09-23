import { FlareDevtools } from "@priemskiyyy/flare-devtools/react";
import { FlareProvider } from "@priemskiyyy/flare-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Application } from "src/Application";
import { createExampleBackend } from "src/backend/createExampleBackend";
import { createExampleFlare } from "src/reporting/createExampleFlare";
import "src/styles.css";

const backend = createExampleBackend();
const flare = createExampleFlare({ fetch: backend.fetch });

flare.start();

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page has no #root element.");
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <FlareProvider flare={flare}>
      <Application backend={backend} />
      <FlareDevtools />
    </FlareProvider>
  </StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount();
    flare.dispose();
  });
}
