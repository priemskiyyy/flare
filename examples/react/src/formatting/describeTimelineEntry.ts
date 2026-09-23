import { formatShortId } from "src/formatting/formatShortId";
import type { TimelineEntry } from "src/types/TimelineEntry";
import type { Tone } from "src/types/Tone";
import {
  DESTINATION_GUIDES,
  DESTINATION_NAMES,
} from "src/utils/constants/destinations";
import { OUTCOME_LABELS, OUTCOME_ORDER } from "src/utils/constants/labels";
import { OUTCOME_TONES } from "src/utils/constants/tones";
import { readString } from "src/utils/readString";

type TimelineLine = { text: string; tone: Tone };

const readContextField = (context: unknown, field: string) => {
  if (typeof context !== "object" || context === null || !(field in context)) {
    return null;
  }

  return readString(Reflect.get(context, field));
};

const getDestinationLabel = (name: string | null) => {
  const destination = DESTINATION_NAMES.find((known) => known === name);

  if (destination === undefined) {
    return name ?? "";
  }

  return DESTINATION_GUIDES[destination].name;
};

const getReportLabel = (report: string | null) => {
  if (report === null) {
    return "";
  }

  return formatShortId(report);
};

const describeOutcome = (label: string, context: unknown): TimelineLine => {
  const field = readContextField(context, "status");
  const status = OUTCOME_ORDER.find((known) => known === field);
  const reason = readContextField(context, "reason");

  if (status === undefined) {
    return { text: `${label} answered`, tone: "neutral" };
  }

  const answered = `${label}: ${OUTCOME_LABELS[status]}`;

  if (reason === null) {
    return { text: answered, tone: OUTCOME_TONES[status] };
  }

  return { text: `${answered}, ${reason}`, tone: OUTCOME_TONES[status] };
};

/** A diagnostic event as a sentence, with the tone the timeline shows it in. */
export const describeTimelineEntry = (entry: TimelineEntry): TimelineLine => {
  const report = getReportLabel(entry.report);
  const label = getDestinationLabel(entry.destination);

  if (entry.type === "report accepted") {
    return { text: `Report ${report} accepted`, tone: "accent" };
  }

  if (entry.type === "report dropped") {
    const reason = readContextField(entry.context, "reason") ?? "";

    return { text: `Report ${report} dropped, ${reason}`, tone: "neutral" };
  }

  if (entry.type === "report buffered") {
    return {
      text: `${label} holds report ${report} until it starts`,
      tone: "info",
    };
  }

  if (entry.type === "destination submit") {
    return { text: `${label} is sending report ${report}`, tone: "neutral" };
  }

  if (entry.type === "destination outcome") {
    return describeOutcome(label, entry.context);
  }

  if (entry.type === "destination ready") {
    return { text: `${label} is ready`, tone: "positive" };
  }

  if (entry.type === "destination failed") {
    return { text: `${label} failed to start`, tone: "danger" };
  }

  if (entry.type === "destination disposed") {
    return { text: `${label} closed`, tone: "neutral" };
  }

  if (entry.type === "identity changed") {
    return { text: "The signed-in account changed", tone: "accent" };
  }

  if (entry.type === "started") {
    return { text: "Flare started", tone: "positive" };
  }

  if (entry.type === "flushed") {
    return { text: "Flush finished", tone: "neutral" };
  }

  return { text: entry.type, tone: "neutral" };
};
