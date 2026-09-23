import type { Section } from "src/types/Section";
import type { SectionId } from "src/types/SectionId";

export const SECTIONS: Record<SectionId, Section> = {
  app: { number: 1, title: "Make something fail", label: "Try it" },
  receipts: {
    number: 2,
    title: "Every report, accounted for",
    label: "Receipts",
  },
  destinations: {
    number: 3,
    title: "One report, five destinations",
    label: "Destinations",
  },
  lab: { number: 4, title: "Break the destinations", label: "Lab" },
  timeline: { number: 5, title: "Watch it happen", label: "Timeline" },
};

export const SECTION_IDS: SectionId[] = [
  "app",
  "receipts",
  "destinations",
  "lab",
  "timeline",
];
