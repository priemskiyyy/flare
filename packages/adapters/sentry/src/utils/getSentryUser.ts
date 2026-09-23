import type { FlareUser } from "@priemskiyyy/flare";

import type { SentryEventLike } from "src/types/SentryEventLike";

export const getSentryUser = (user: FlareUser | null) => {
  if (user === null) {
    return null;
  }

  const sentryUser: NonNullable<SentryEventLike["user"]> = { id: user.id };

  if (user.email !== undefined) {
    sentryUser.email = user.email;
  }

  // Sentry calls the display name `username`.
  if (user.name !== undefined) {
    sentryUser.username = user.name;
  }

  return sentryUser;
};
