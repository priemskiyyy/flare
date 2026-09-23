export type EventLog<T> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T[];
  clear: () => void;
};
