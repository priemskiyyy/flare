import type { HttpAcknowledgement } from "src/types/HttpAcknowledgement";
import type { HttpRequest } from "src/types/HttpRequest";

/**
 * An application's own client for the tests: it records every request and
 * answers with an id the backend gave the report, until the next answer is
 * replaced.
 */
export const fakeRequest = () => {
  const requests: HttpRequest[] = [];
  let next: (() => Promise<HttpAcknowledgement | void>) | null = null;

  const request = (sent: HttpRequest) => {
    requests.push(sent);

    if (next !== null) {
      const answer = next;

      next = null;

      return answer();
    }

    return Promise.resolve({ id: `evt_${requests.length}` });
  };

  return {
    request,
    requests,
    /** The next request resolves with this, as a client whose backend gave no id does. */
    answerNext: (acknowledgement: HttpAcknowledgement | void) => {
      next = () => Promise.resolve(acknowledgement);
    },
    /** The next request rejects, as a refusal or an unreachable network does. */
    failNext: (error: Error) => {
      next = () => Promise.reject(error);
    },
    /** The next request never settles. */
    hangNext: () => {
      next = () => new Promise(() => {});
    },
  };
};
