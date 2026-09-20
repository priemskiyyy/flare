export { default as FlareErrorBoundary } from "./components/FlareErrorBoundary.svelte";
export { default as FlareProvider } from "./context/FlareProvider.svelte";
export { useDestinationStatus } from "./utilities/useDestinationStatus.js";
export { useFlare } from "./utilities/useFlare.js";
export { useFlareStatus } from "./utilities/useFlareStatus.js";

export type { FlareErrorBoundaryProps } from "./types/FlareErrorBoundaryProps.js";
export type { FlareProviderProps } from "./types/FlareProviderProps.js";
export type { ReadableValue } from "./types/ReadableValue.js";
export type {
  Register,
  RegisteredDestinationName,
  RegisteredDestinations,
  RegisteredFlare,
  RegisteredSchema,
} from "./types/Register.js";
