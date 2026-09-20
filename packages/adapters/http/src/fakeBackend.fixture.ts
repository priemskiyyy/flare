type Recorded = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal: AbortSignal;
};

type Init = {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
};

/**
 * An error ingestion backend for the tests: a `fetch` that records every
 * request and answers `202` with an id, until the next answer is replaced.
 */
export const fakeBackend = () => {
  const endpoint = "https://api.example.test/error-reports";
  const requests: Recorded[] = [];
  let next: (() => Promise<Response>) | null = null;

  const fetch = async (url: string, init: Init) => {
    requests.push({
      method: init.method,
      url,
      headers: Object.fromEntries(new Headers(init.headers)),
      body: JSON.parse(init.body),
      signal: init.signal,
    });

    if (next !== null) {
      const answer = next;
      next = null;
      return answer();
    }
    return Response.json({ id: `evt_${requests.length}` }, { status: 202 });
  };

  return {
    endpoint,
    requests,
    fetch,
    /** The next request is answered with this status and body. */
    answerNext: (status: number, body: string | null = null) => {
      next = () => Promise.resolve(new Response(body, { status }));
    },
    /** The next request fails the way an unreachable network does. */
    failNext: (error: Error) => {
      next = () => Promise.reject(error);
    },
    /** The next request never answers. */
    hangNext: () => {
      next = () => new Promise<Response>(() => {});
    },
  };
};
