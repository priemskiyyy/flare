const pad = (value: number, length: number) =>
  String(value).padStart(length, "0");

/** Local time with millisecond precision. */
export const formatEventTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}`;
};
