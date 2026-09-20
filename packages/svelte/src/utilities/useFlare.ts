import { useFlareContext } from "./internal/useFlareContext.js";

/**
 * Follows the nearest provider's Flare through `current`, and throws when the
 * provider is missing. Reading it starts nothing. Augment `Register` to type it.
 *
 * @example
 * ```ts
 * const flare = useFlare();
 *
 * const handleSaveClick = () => save().catch(flare.current.capture);
 * ```
 */
export const useFlare = () => useFlareContext("Flare utilities");
