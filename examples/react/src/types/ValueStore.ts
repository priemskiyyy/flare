import type { ObservableValue } from "@priemskiyyy/flare";

export type ValueStore<T> = ObservableValue<T> & { set: (next: T) => void };
