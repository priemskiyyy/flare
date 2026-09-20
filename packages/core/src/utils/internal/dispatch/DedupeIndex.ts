type Occurrence = {
  destination: string;
  generation: number;
  key: string | null;
  thrown: unknown;
  now: number;
};

type DestinationHistory = {
  generation: number;
  keys: Set<string>;
  objects: WeakMap<object, number>;
};

/**
 * Remembers what each destination has already been sent. An explicit key is
 * remembered per identity generation in a bounded list; an object is
 * remembered only briefly, so an Error that is legitimately thrown again
 * later is reported again. Equal messages are separate occurrences.
 */
export class DedupeIndex {
  #windowMs: number;
  #maxKeys: number;
  #destinations = new Map<string, DestinationHistory>();

  constructor({ windowMs, maxKeys }: { windowMs: number; maxKeys: number }) {
    this.#windowMs = windowMs;
    this.#maxKeys = maxKeys;
  }

  isDuplicate = ({ destination, generation, key, thrown, now }: Occurrence) => {
    const { keys, objects } = this.#history(destination, generation);
    if (key !== null) {
      if (keys.has(key)) {
        return true;
      }

      keys.add(key);
      if (keys.size > this.#maxKeys) {
        for (const oldest of keys) {
          keys.delete(oldest);
          break;
        }
      }
      return false;
    }

    if (typeof thrown !== "object" || thrown === null) {
      return false;
    }
    if (this.#windowMs <= 0) {
      return false;
    }

    const previous = objects.get(thrown);
    objects.set(thrown, now);
    return previous !== undefined && now - previous < this.#windowMs;
  };

  #history(destination: string, generation: number): DestinationHistory {
    const existing = this.#destinations.get(destination);
    if (existing !== undefined && existing.generation === generation) {
      return existing;
    }
    const history: DestinationHistory = {
      generation,
      keys: new Set(),
      objects: new WeakMap(),
    };
    this.#destinations.set(destination, history);
    return history;
  }
}
