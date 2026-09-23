import { expect, test } from "vitest";

import { isSensitiveKey } from "src/utils/isSensitiveKey";

test.each([
  "accessToken",
  "Authorization",
  "password",
  "passwd",
  "clientSecret",
  "cookie",
  "api_key",
  "apiKey",
  "API-KEY",
  "privateKey",
  "private_key",
  "access_key",
  "credentials",
  "bearer",
  "jwt",
  "sessionId",
  "session_id",
])("%s names a credential", (key) => {
  expect(isSensitiveKey(key)).toBe(true);
});

test.each(["plan", "amount", "author", "path", "email", "session"])(
  "%s does not",
  (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  },
);
