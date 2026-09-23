export const formatClockTime = (at: number) =>
  new Date(at).toLocaleTimeString("en-GB", { hour12: false });
