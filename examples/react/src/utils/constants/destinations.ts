import type { DestinationGuide } from "src/types/DestinationGuide";
import type { LedgerDestination } from "src/types/LedgerDestination";

export const DESTINATION_GUIDES: Record<LedgerDestination, DestinationGuide> = {
  backend: {
    name: "Your API",
    provider: "@priemskiyyy/flare-http over the lab network",
    evidence: "Backend acknowledged",
    messages: "Sent",
    flush: "None",
  },
  console: {
    name: "Console",
    provider: "@priemskiyyy/flare-console with an in-page writer",
    evidence: "SDK call returned",
    messages: "Sent",
    flush: "None",
  },
  sentry: {
    name: "Sentry",
    provider: "@priemskiyyy/flare-sentry over a simulated SDK",
    evidence: "SDK call returned, with an event id",
    messages: "Sent",
    flush: "Flushes",
  },
  posthog: {
    name: "PostHog",
    provider: "@priemskiyyy/flare-posthog over a simulated SDK",
    evidence: "SDK call returned, with an event id",
    messages: "Skipped",
    flush: "None",
  },
  datadog: {
    name: "Datadog",
    provider: "@priemskiyyy/flare-datadog over a simulated RUM SDK",
    evidence: "SDK call returned",
    messages: "Skipped",
    flush: "None",
  },
};

export const DESTINATION_NAMES: LedgerDestination[] = [
  "backend",
  "console",
  "sentry",
  "posthog",
  "datadog",
];

/** Billing reports hold payment details, so only the payment team's tools get them. */
export const BILLING_DESTINATIONS: LedgerDestination[] = [
  "backend",
  "sentry",
  "console",
];

export const PRODUCT_DESTINATIONS: LedgerDestination[] = [
  "sentry",
  "posthog",
  "datadog",
  "console",
];
