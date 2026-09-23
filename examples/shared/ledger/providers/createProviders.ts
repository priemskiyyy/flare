import { createSimulatedDatadog } from "examples/shared/ledger/providers/createSimulatedDatadog";
import { createSimulatedPostHog } from "examples/shared/ledger/providers/createSimulatedPostHog";
import { createSimulatedSentry } from "examples/shared/ledger/providers/createSimulatedSentry";

/** The SDKs the application owns, created once and shared by every runtime. */
export const createProviders = () => ({
  sentry: createSimulatedSentry(),
  posthog: createSimulatedPostHog(),
  datadog: createSimulatedDatadog(),
});
