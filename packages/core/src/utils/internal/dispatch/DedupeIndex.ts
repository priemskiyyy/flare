type Occurrence = {
  generation: number;
  key: string | null;
  thrown: unknown;
  now: number;
};

/**
 * Remembers what one destination has already been sent, for one identity at
 * a time. An explicit key is remembered in a bounded list; an object is
 * remembered only briefly, so an Error that is legitimately thrown again
 * later is reported again. Equal messages are separate occurrences.
 */
export class DedupeIndex {
  #window: number;
  #maxKeys: number;
  #generation: number | null = null;
  #keys = new Set<string>();
  #objects = new WeakMap<object, number>();

  constructor(options: { window: number; maxKeys: number }) {
    this.#window = options.window;
    this.#maxKeys = options.maxKeys;
  }

  isDuplicate = ({ generation, key, thrown, now }: Occurrence) => {
    // What one account was sent says nothing about the next one.
    if (generation !== this.#generation) {
      this.#generation = generation;
      this.#keys = new Set();
      this.#objects = new WeakMap();
    }

    if (key !== null) {
      return this.#isDuplicateKey(key);
    }

    return this.#isDuplicateObject(thrown, now);
  };

  #isDuplicateKey(key: string) {
    if (this.#keys.has(key)) {
      return true;
    }

    this.#keys.add(key);

    if (this.#keys.size > this.#maxKeys) {
      // A Set iterates in insertion order, so the first key is the oldest.
      const { value: oldest } = this.#keys.values().next();

      if (oldest !== undefined) {
        this.#keys.delete(oldest);
      }
    }

    return false;
  }

  #isDuplicateObject(thrown: unknown, now: number) {
    if (typeof thrown !== "object" || thrown === null) {
      return false;
    }

    if (this.#window <= 0) {
      return false;
    }

    const previous = this.#objects.get(thrown);

    this.#objects.set(thrown, now);

    // A clock that stepped back says nothing about how long ago it was seen.
    return (
      previous !== undefined && now >= previous && now - previous < this.#window
    );
  }
}
