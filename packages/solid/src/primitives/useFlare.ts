import { useFlareContext } from "src/primitives/internal/useFlareContext";

/**
 * Follows the nearest provider's Flare as an accessor, and throws when the
 * provider is missing. Reading it starts nothing. Augment `Register` to type it.
 *
 * @example
 * ```ts
 * const flare = useFlare();
 *
 * const handleSaveClick = () => save().catch(flare().capture);
 * ```
 */
export const useFlare = () => useFlareContext("Flare primitives");
