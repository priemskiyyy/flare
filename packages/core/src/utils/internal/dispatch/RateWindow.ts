const WINDOW_MS = 60_000;

/**
 * A fixed one-minute window. An error loop can capture thousands of reports
 * a second, and every one of them would fan out to every destination.
 */
export class RateWindow {
  #perMinute: number;
  #startedAt = Number.NEGATIVE_INFINITY;
  #count = 0;

  constructor({ perMinute }: { perMinute: number }) {
    this.#perMinute = perMinute;
  }

  /** `refused-first` marks the first refusal of a window, so it can be announced once. */
  admit = (now: number): "admitted" | "refused-first" | "refused" => {
    if (now - this.#startedAt >= WINDOW_MS) {
      this.#startedAt = now;
      this.#count = 0;
    }

    this.#count += 1;
    if (this.#count <= this.#perMinute) {
      return "admitted";
    }

    if (this.#count === this.#perMinute + 1) {
      return "refused-first";
    }
    return "refused";
  };
}
