/** One event a simulated provider SDK received, as it would store it. */
export type ProviderEvent = {
  id: string;
  reportId: string | null;
  title: string;
  user: string | null;
  body: unknown;
  at: number;
};
