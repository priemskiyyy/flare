import arrowCounterClockwise from "@phosphor-icons/core/bold/arrow-counter-clockwise-bold.svg?url";
import arrowsSplit from "@phosphor-icons/core/bold/arrows-split-bold.svg?url";
import checkCircle from "@phosphor-icons/core/bold/check-circle-bold.svg?url";
import circleNotch from "@phosphor-icons/core/bold/circle-notch-bold.svg?url";
import creditCard from "@phosphor-icons/core/bold/credit-card-bold.svg?url";
import eye from "@phosphor-icons/core/bold/eye-bold.svg?url";
import minusCircle from "@phosphor-icons/core/bold/minus-circle-bold.svg?url";
import paperPlaneTilt from "@phosphor-icons/core/bold/paper-plane-tilt-bold.svg?url";
import paperclip from "@phosphor-icons/core/bold/paperclip-bold.svg?url";
import prohibit from "@phosphor-icons/core/bold/prohibit-bold.svg?url";
import question from "@phosphor-icons/core/bold/question-bold.svg?url";
import xCircle from "@phosphor-icons/core/bold/x-circle-bold.svg?url";
import broadcast from "@phosphor-icons/core/duotone/broadcast-duotone.svg?url";
import bug from "@phosphor-icons/core/duotone/bug-duotone.svg?url";
import chartLine from "@phosphor-icons/core/duotone/chart-line-duotone.svg?url";
import database from "@phosphor-icons/core/duotone/database-duotone.svg?url";
import fileText from "@phosphor-icons/core/duotone/file-text-duotone.svg?url";
import flame from "@phosphor-icons/core/duotone/flame-duotone.svg?url";
import lightning from "@phosphor-icons/core/duotone/lightning-duotone.svg?url";
import prohibitDuotone from "@phosphor-icons/core/duotone/prohibit-duotone.svg?url";
import pulse from "@phosphor-icons/core/duotone/pulse-duotone.svg?url";
import signOut from "@phosphor-icons/core/duotone/sign-out-duotone.svg?url";
import terminal from "@phosphor-icons/core/duotone/terminal-duotone.svg?url";

import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import type { OutcomeStatus } from "examples/shared/ledger/types/OutcomeStatus";

/** The Phosphor icons the Vue, Solid and Svelte examples draw as CSS masks. */
export const ICONS = {
  arrowCounterClockwise,
  broadcast,
  creditCard,
  eye,
  fileText,
  flame,
  lightning,
  paperPlaneTilt,
  paperclip,
  prohibit: prohibitDuotone,
  signOut,
};

export const DESTINATION_ICONS: Record<LedgerDestination, string> = {
  backend: database,
  console: terminal,
  sentry: bug,
  posthog: chartLine,
  datadog: pulse,
};

export const OUTCOME_ICONS: Record<OutcomeStatus, string> = {
  pending: circleNotch,
  submitted: checkCircle,
  skipped: minusCircle,
  dropped: prohibit,
  failed: xCircle,
  indeterminate: question,
  "not-routed": arrowsSplit,
};
