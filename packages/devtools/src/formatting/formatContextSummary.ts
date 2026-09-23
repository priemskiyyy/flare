const field = (context: object, key: string): unknown => {
  if (!(key in context)) {
    return undefined;
  }

  return Reflect.get(context, key);
};

const count = (amount: number, singular: string) => {
  if (amount === 1) {
    return `${amount} ${singular}`;
  }

  return `${amount} ${singular}es`;
};

// A context counts its losses, or lists them.
const readLossCount = (losses: unknown) => {
  if (Array.isArray(losses)) {
    return losses.length;
  }

  if (typeof losses === "number") {
    return losses;
  }

  return 0;
};

/** One-line row text from the fields Flare's contexts carry. `value` is the inspected copy. */
export const formatContextSummary = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const parts: string[] = [];
  const kind = field(value, "kind");
  const status = field(value, "status");
  const reason = field(value, "reason");
  const destinations = field(value, "destinations");
  const losses = field(value, "losses");
  const generation = field(value, "generation");
  const buffered = field(value, "buffered");
  const timeout = field(value, "timeout");
  const name = field(value, "name");
  const path = field(value, "path");

  if (typeof kind === "string") {
    parts.push(kind);
  }

  if (typeof status === "string") {
    parts.push(status);
  }

  if (typeof reason === "string") {
    parts.push(reason);
  }

  if (Array.isArray(destinations)) {
    parts.push(destinations.map(String).join(", "));
  }

  const lossCount = readLossCount(losses);

  if (lossCount > 0) {
    parts.push(count(lossCount, "loss"));
  }

  if (typeof generation === "number") {
    parts.push(`#${generation}`);
  }

  if (typeof buffered === "number") {
    parts.push(`${buffered} buffered`);
  }

  if (typeof timeout === "number") {
    parts.push(`${timeout} ms`);
  }

  if (typeof name === "string") {
    parts.push(name);
  }

  if (typeof path === "string") {
    parts.push(path);
  }

  return parts.join(" · ");
};
