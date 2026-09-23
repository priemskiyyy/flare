import {
  ArrowsSplit,
  Bug,
  ChartLine,
  CheckCircle,
  CircleNotch,
  Database,
  MinusCircle,
  Prohibit,
  Pulse,
  Question,
  Terminal,
  XCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import type { OutcomeStatus } from "examples/shared/ledger/types/OutcomeStatus";

export const DESTINATION_ICONS: Record<LedgerDestination, Icon> = {
  backend: Database,
  console: Terminal,
  sentry: Bug,
  posthog: ChartLine,
  datadog: Pulse,
};

export const OUTCOME_ICONS: Record<OutcomeStatus, Icon> = {
  pending: CircleNotch,
  submitted: CheckCircle,
  skipped: MinusCircle,
  dropped: Prohibit,
  failed: XCircle,
  indeterminate: Question,
  "not-routed": ArrowsSplit,
};
