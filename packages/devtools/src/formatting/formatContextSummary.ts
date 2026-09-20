const field = (context: object, key: string): unknown =>
  key in context ? Reflect.get(context, key) : undefined;

const count = (amount: number, singular: string) =>
  `${amount} ${amount === 1 ? singular : `${singular}es`}`;

/** One-line row text from the fields Flare's contexts carry. `value` is the inspected copy. */
export const formatContextSummary = (value: unknown) => {
  if (typeof value !== "object" || value === null) {
    return value === undefined || value === null ? "" : String(value);
  }

  const parts: string[] = [];
  const kind = field(value, "kind");
  const status = field(value, "status");
  const reason = field(value, "reason");
  const destinations = field(value, "destinations");
  const losses = field(value, "losses");
  const generation = field(value, "generation");
  const buffered = field(value, "buffered");
  const timeoutMs = field(value, "timeoutMs");
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

  const lossCount = Array.isArray(losses) ? losses.length : losses;
  if (typeof lossCount === "number" && lossCount > 0) {
    parts.push(count(lossCount, "loss"));
  }

  if (typeof generation === "number") {
    parts.push(`#${generation}`);
  }

  if (typeof buffered === "number") {
    parts.push(`${buffered} buffered`);
  }

  if (typeof timeoutMs === "number") {
    parts.push(`${timeoutMs} ms`);
  }

  if (typeof name === "string") {
    parts.push(name);
  }

  if (typeof path === "string") {
    parts.push(path);
  }

  return parts.join(" · ");
};
