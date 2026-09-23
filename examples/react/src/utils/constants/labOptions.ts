import type { Option } from "src/types/Option";

/** 8 s outlasts the 3 s timeout, so the backend's outcome is unconfirmed. */
export const LATENCY_OPTIONS: Option<number>[] = [
  { value: 0, label: "0 ms" },
  { value: 400, label: "400 ms" },
  { value: 8_000, label: "8 s" },
];
