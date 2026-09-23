import { createSimulatedDatadog } from "src/providers/createSimulatedDatadog";
import { createSimulatedPostHog } from "src/providers/createSimulatedPostHog";
import { createSimulatedSentry } from "src/providers/createSimulatedSentry";

/** The SDKs the application owns, created once and shared by every runtime. */
export const createProviders = () => ({
  sentry: createSimulatedSentry(),
  posthog: createSimulatedPostHog(),
  datadog: createSimulatedDatadog(),
});
