export const readString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  return value;
};
