import type { ObservedDestination } from "src/types/ObservedDestination";

export const formatDestinationLine = ({
  adapter,
  status,
  buffered,
  inFlight,
}: Pick<ObservedDestination, "adapter" | "status" | "buffered" | "inFlight">) =>
  [
    adapter,
    status.state,
    ...(buffered > 0 ? [`${buffered} buffered`] : []),
    ...(inFlight > 0 ? [`${inFlight} in flight`] : []),
  ].join(" · ");
