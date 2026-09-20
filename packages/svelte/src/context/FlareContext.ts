import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredFlare } from "../types/Register.js";

export type FlareContextValue = ReadableValue<RegisteredFlare>;

export const FLARE_CONTEXT = Symbol("flare");
