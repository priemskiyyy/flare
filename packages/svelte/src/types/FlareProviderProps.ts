import type { Snippet } from "svelte";
import type { RegisteredFlare } from "./Register.js";

export type FlareProviderProps = {
  flare: RegisteredFlare;
  children?: Snippet | undefined;
};
