/** Recognizes a promise from any realm, and any other thenable, by shape. */
export const isPromiseLike = (
  value: unknown,
): value is PromiseLike<unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "then" in value && typeof value.then === "function";
};
