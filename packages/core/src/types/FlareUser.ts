/**
 * Who a report belongs to. `id` is the identity: changing it starts a new
 * identity generation, while changing `email` or `name` under the same `id`
 * does not. Anything richer belongs in a context.
 *
 * @example
 * ```ts
 * flare.user({ id: "user_42", email: "ada@example.com" });
 * flare.user(null);
 * ```
 */
export type FlareUser = {
  id: string;
  email?: string;
  name?: string;
};
