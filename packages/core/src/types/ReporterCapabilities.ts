import type { SubmissionEvidence } from "src/types/SubmissionEvidence";

/**
 * What this adapter, on this SDK and platform, can honestly do. It describes
 * a combination, not a provider brand: the same provider can differ between
 * the browser and React Native. Flare snapshots this declaration when the
 * destination is constructed.
 *
 * @example
 * ```ts
 * if (!flare.destination("crashlytics").capabilities.eventLocal.contexts) {
 *   // contexts reach Crashlytics only through its ambient integration
 * }
 * ```
 */
export type ReporterCapabilities = {
  /** Which report fields the provider accepts per event, without touching its globals. */
  readonly eventLocal: {
    readonly user: boolean;
    readonly tags: boolean;
    readonly contexts: boolean;
    readonly breadcrumbs: boolean;
  };
  /** Whether a message report can be sent as something other than a fake Error. */
  readonly messages: boolean;
  /** The strongest evidence a submission can come back with. */
  readonly evidence: SubmissionEvidence;
  /**
   * What `flush` waits for. `none` means the session has no `flush` method,
   * `sdk-queue` that the SDK's own queue drained, `native-handoff` that events
   * were handed to a native SDK which sends them on its own schedule, and
   * `backend-acknowledged` that a backend answered.
   */
  readonly flush:
    "none" | "sdk-queue" | "native-handoff" | "backend-acknowledged";
  /** Who owns queueing and retry once a report is handed over. */
  readonly queue: "none" | "sdk-memory" | "sdk-persistent";
  /** Whether the provider captures unhandled or native errors on its own. */
  readonly automaticCapture: "none" | "provider-owned";
  /** Whether the provider SDK is one process-wide instance. */
  readonly instance: "singleton" | "instance";
  /** Whether provider-side hooks such as sampling can still drop a submitted report. */
  readonly filtering: "none" | "provider-hooks";
};
