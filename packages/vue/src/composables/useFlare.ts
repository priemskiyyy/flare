import { useFlareContext } from "src/composables/internal/useFlareContext";

/**
 * Returns the nearest provider's Flare as a computed ref, and throws when the
 * provider is missing. Reading it starts nothing. Augment `Register` to type it.
 *
 * @example
 * ```ts
 * const flare = useFlare();
 *
 * const handleSaveClick = () => save().catch(flare.value.capture);
 * ```
 */
export const useFlare = () => useFlareContext("Flare composables");
