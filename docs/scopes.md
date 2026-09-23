---
description: "Bind tags, contexts and an operation name to one unit of work with a Flare scope, without touching global state."
---

# Operation scopes

A scope carries metadata for one unit of work. It is a plain value, not a global, so two operations running at the same time can never see each other's data.

```ts
const upload = flare.scope({
  operation: "upload-avatar",
  tags: { area: "upload" },
  contexts: { file: { size: 48_213, type: "image/png" } },
});

try {
  await uploadAvatar();
} catch (error) {
  upload.capture(error);
}

upload.message("Upload was slow", { level: "warning" });
```

A scope has `capture` and `message`, with the same options as the ones on the Flare. Options given at the call win over the scope's, which win over the session's.

## What a scope does not do

- **It does not collect.** There is no `scope.tag()` or `scope.breadcrumb()`. A scope is fixed when it is created. If the work needs different metadata, create another scope.
- **It does not nest.** There is no parent. Combine options yourself when you need to.
- **It does not end.** There is nothing to close and nothing to leak, so you can create one per request, per upload or per screen.
- **It does not propagate.** Flare never uses async context or a global stack to find a scope. You pass the scope to the code that needs it, which is the only approach that behaves the same in browsers, in React Native and on a server.

## Scopes and accounts

A scope belongs to the identity it was created under. After the user changes, every capture through that scope is dropped with the reason `stale-scope`. See [users and account switching](identity.md).

## Scopes on a server

On a server, one Flare serves many requests, so session data such as `flare.user()` is the wrong tool: it would be shared by every request. Use a scope per request and pass the user in it:

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

See [server rendering](server-rendering.md).
