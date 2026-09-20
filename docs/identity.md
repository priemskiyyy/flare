---
description: "How Flare keeps one account's data out of another account's reports when the user signs in, signs out or switches account."
---

# Users and account switching

```ts
flare.user({ id: "user_42", email: "ada@example.com", name: "Ada" });
flare.user(null);
```

A user has an `id`, and optionally an `email` and a `name`. The `id` is required, because it is what tells two accounts apart.

## An id change starts a new identity

When the `id` changes, including to or from `null`, Flare begins a new identity generation and clears what belonged to the previous account:

- every session tag
- every session context
- every breadcrumb

Application `defaults` stay, because they describe the application and not the account. Setting the same id again, or changing only the email or the name, changes nothing else.

This is deliberate and not configurable. Breadcrumbs of one account appearing in a report attributed to another is a privacy incident, and it is exactly the kind of bug that is invisible in development, where there is one account.

## Work that outlives a switch

An upload starts under one account. The user signs out and someone else signs in. Then the upload fails. Attributing that failure to the new account would be wrong, so a [scope](scopes.md) remembers the identity it was created under:

```ts
const upload = flare.scope({ operation: "upload-avatar" });

try {
  await uploadAvatar();
} catch (error) {
  upload.capture(error);
}
```

If the account changed while `uploadAvatar()` was running, the capture is dropped with the reason `stale-scope`. Dropping is the only safe answer: the old account's session data is already gone, and the new account had nothing to do with it.

## Reports in flight

A report is complete and frozen when `capture()` returns, including the user it belongs to. A report that is still waiting in the startup buffer when the account changes keeps its original user and is delivered with it.

Providers whose SDK keeps the user globally make this harder, and each adapter handles it for you:

- **Sentry and Bugsnag** apply the report's own user to that one event and clear anything the ambient mirror wrote for a different account.
- **Crashlytics** cannot attach a user to one report. When the ambient user is mirrored and differs from the report's user, the adapter skips the report with the reason `identity-mismatch` instead of filing it under the wrong account.

See [provider limitations](provider-limitations.md).

## One report for someone else

```ts
flare.capture(error, { user: { id: "user_7" } });
flare.capture(error, { user: null });
```

The `user` option overrides the session user for that report only. It does not start a new identity.

## What Flare does with the id

The id goes through redaction like everything else. Flare keeps the real id in memory only to compare accounts, so two different accounts can never look like one because both ids were redacted to the same text.
