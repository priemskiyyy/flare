---
description: "Why importing and constructing Flare is safe during server rendering, how to scope reports per request, and what the React bindings render on the server."
---

# Server rendering

## Importing and constructing are inert

No Flare package does anything on import. `new Flare()` allocates plain objects: it opens no destination, starts no timer, touches no global and reads no environment. A module that creates a Flare can be imported by a server render, a test or a build step without effect.

Work begins at `start()`. Whether to call it on the server is your choice:

- **Client only.** Call `start()` from client code. On the server, captures are buffered for a minute and then dropped, which costs a little memory and sends nothing.
- **Server too.** Call `start()` on the server with destinations that make sense there, such as the HTTP adapter or a server-side provider SDK.

## One Flare, many requests

On a server, a module-level Flare is shared by every request. Session calls such as `flare.user()` and `flare.tag()` would therefore mix requests, which is the cross-account leak Flare exists to prevent. Use a [scope](scopes.md) per request and pass the user in it:

```ts
const handleRequest = async (request: Request, userId: string) => {
  const scope = flare.scope({
    operation: `${request.method} ${new URL(request.url).pathname}`,
    user: { id: userId },
  });

  try {
    return await respond(request);
  } catch (error) {
    scope.capture(error);
    return new Response("Internal error", { status: 500 });
  }
};
```

A scope is a value you pass along, not async context, so it behaves the same in Node, in edge runtimes and in the browser.

## Flush before the runtime freezes

A serverless or edge function may be frozen as soon as the response is sent. Flush first, or hand the promise to the platform's `waitUntil`:

```ts
const handleFetch = async (
  request: Request,
  context: { waitUntil: (work: Promise<unknown>) => void },
) => {
  const response = await respond(request);
  context.waitUntil(flare.flush({ timeoutMs: 2000 }));
  return response;
};
```

## Bindings on the server

In every binding, the provider and the status readers render on the server without effect. The status readers read `idle` there and until the component is mounted, even when Flare was already started, so server markup and the hydrating render always match. What differs is the error boundary, because each framework treats a render error on the server differently:

| Binding | A render error on the server                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React   | Is not caught by a boundary. Catch it in your framework's server error hook and report it with `flare.capture`.                                                                                        |
| Vue     | Is captured. The boundary reports it through the server's Flare and stops it there, but renders nothing in its place, because server rendering is a single pass.                                       |
| Solid   | Is caught. The boundary reports it through the server's Flare and renders the fallback. Solid replays the error while hydrating, so the client's boundary reports it again through the client's Flare. |
| Svelte  | Is not caught by a boundary. The error leaves `render()` when the markup is read. Catch it there and report it.                                                                                        |

The Vue, Solid and Svelte rows are pinned by tests in this repository. The React row is React's documented rule.

## React on the server

`FlareProvider`, the status hooks and `FlareErrorBoundary` render on the server without effect. The hooks read `idle` on the server and during hydration, even when the client has already started Flare, so the markup matches. The entries carry a `"use client"` directive, so they can be imported from a React Server Components tree.

An error boundary does not catch errors thrown during server rendering. That is React's rule. Catch those in your framework's server error hook and report them with `flare.capture`.
