import type { IncomingHttpHeaders } from "node:http";

export type ReceivedRequest = {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
};
