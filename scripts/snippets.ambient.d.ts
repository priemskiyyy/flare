// Names a documentation example may use without declaring them. They stand
// for the reader's own application and for provider SDKs the reader installs.
import type { Flare, ReporterAdapter } from "@priemskiyyy/flare";
import type { TraceEventSource } from "@priemskiyyy/flare-trace";
import type { ReactNode } from "react";

declare global {
  /** The application's Flare, with the destinations most examples route to. */
  const flare: Flare<{
    sentry: ReporterAdapter<typeof Sentry>;
    backend: ReporterAdapter<{ endpoint: string }>;
    console: ReporterAdapter;
  }>;
  const session: {
    token: string;
    getToken: () => Promise<string>;
    user: { id: string; email: string };
  };
  const error: unknown;
  const cartId: string;
  const apiKey: string;
  const dsn: string;
  const trace: {
    events: TraceEventSource<{
      "checkout.started": { cartId: string; total: number };
      "page.viewed": { path: string };
    }>;
  };
  const save: () => Promise<void>;
  const submit: () => Promise<void>;
  const uploadAvatar: () => Promise<void>;
  const respond: (request: Request) => Promise<Response>;
  const showOfflineBanner: () => void;
  const Application: () => ReactNode;
  const Cart: () => ReactNode;
  const RetryScreen: (props: {
    error: unknown;
    onRetryPress: () => void;
  }) => ReactNode;
}
