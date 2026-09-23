import { readField } from "src/readField";

const readList = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
};

/**
 * An OTLP JSON `AnyValue` as the plain value it encodes, so an assertion can
 * match it as an object. A kind it does not know decodes as `undefined`.
 */
export const decodeValue = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("boolValue" in value) {
    return value.boolValue;
  }

  // Protobuf's JSON mapping writes a 64-bit integer as a string.
  if ("intValue" in value) {
    return Number(value.intValue);
  }

  if ("doubleValue" in value) {
    return value.doubleValue;
  }

  if ("arrayValue" in value) {
    return readList(readField(value.arrayValue, "values")).map(decodeValue);
  }

  if ("kvlistValue" in value) {
    return Object.fromEntries(
      readList(readField(value.kvlistValue, "values")).map((entry) => [
        String(readField(entry, "key")),
        decodeValue(readField(entry, "value")),
      ]),
    );
  }

  return undefined;
};
