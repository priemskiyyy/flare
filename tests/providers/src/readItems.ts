import { readField } from "src/readField";
import type { ReceivedRequest } from "src/types/ReceivedRequest";

/** What a provider sent in one JSON array field, across its requests to one path. */
export const readItems = (
  requests: ReceivedRequest[],
  path: string,
  field: string,
): unknown[] =>
  requests
    .filter((request) => request.path.startsWith(path))
    .flatMap((request) => {
      const items = readField(JSON.parse(request.body), field);

      if (!Array.isArray(items)) {
        return [];
      }

      return items;
    });
