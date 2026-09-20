import type { FlareUser } from "@priemskiyyy/flare";

/** Sentry calls the display name `username`. */
export const toSentryUser = (user: FlareUser | null) => {
  if (user === null) {
    return null;
  }

  return {
    id: user.id,
    ...(user.email === undefined ? {} : { email: user.email }),
    ...(user.name === undefined ? {} : { username: user.name }),
  };
};
