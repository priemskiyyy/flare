import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { BreadcrumbOptions } from "src/types/BreadcrumbOptions";
import type { BreadcrumbsOf } from "src/types/BreadcrumbsOf";
import type { CaptureOptions } from "src/types/CaptureOptions";
import type { ContextsOf } from "src/types/ContextsOf";
import type { DestinationHandle } from "src/types/DestinationHandle";
import type { DestinationName } from "src/types/DestinationName";
import type { Destinations } from "src/types/Destinations";
import type { FlareDiagnostics } from "src/types/FlareDiagnostics";
import type { FlareFlushResult } from "src/types/FlareFlushResult";
import type { FlareOptions } from "src/types/FlareOptions";
import type { FlareSchema } from "src/types/FlareSchema";
import type { FlareScope, ReportFunction } from "src/types/FlareScope";
import type { FlareSnapshot } from "src/types/FlareSnapshot";
import type { FlareStatus } from "src/types/FlareStatus";
import type { FlareUser } from "src/types/FlareUser";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { ReportLayer } from "src/types/internal/ReportLayer";
import type { ReportSource } from "src/types/internal/ReportSource";
import type { MappingLoss } from "src/types/MappingLoss";
import type { NativeOf } from "src/types/NativeOf";
import type { ObservableValue } from "src/types/ObservableValue";
import type { Receipt } from "src/types/Receipt";
import type { ReportDropReason } from "src/types/ReportDropReason";
import type { ReportOptions } from "src/types/ReportOptions";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SessionSnapshot } from "src/types/SessionSnapshot";
import type { TagsOf } from "src/types/TagsOf";
import { ValueStore } from "src/utils/common/ValueStore";
import {
  DEFAULT_BUFFER,
  DEFAULT_DEADLINE_MS,
  DEFAULT_DEDUPE,
  DEFAULT_FLUSH_TIMEOUT_MS,
  DEFAULT_REPORTS_PER_MINUTE,
} from "src/utils/constants/defaults";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { DEFAULT_REDACT } from "src/utils/constants/privacy";
import { DestinationRuntime } from "src/utils/internal/destinations/DestinationRuntime";
import { describeOutcome } from "src/utils/internal/diagnostics/describeOutcome";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";
import { createReceipt } from "src/utils/internal/dispatch/createReceipt";
import { DedupeIndex } from "src/utils/internal/dispatch/DedupeIndex";
import { RateWindow } from "src/utils/internal/dispatch/RateWindow";
import { prepareBreadcrumb } from "src/utils/internal/intake/prepareBreadcrumb";
import { prepareContexts } from "src/utils/internal/intake/prepareContexts";
import { prepareReportLayer } from "src/utils/internal/intake/prepareReportLayer";
import { prepareReportPayload } from "src/utils/internal/intake/prepareReportPayload";
import { prepareTags } from "src/utils/internal/intake/prepareTags";
import { prepareUser } from "src/utils/internal/intake/prepareUser";
import { composeReport } from "src/utils/internal/report/composeReport";
import { createReportId } from "src/utils/internal/report/createReportId";
import { fitReport } from "src/utils/internal/report/fitReport";
import { SessionState } from "src/utils/internal/session/SessionState";

type BoundScope = ReturnType<typeof prepareReportLayer> & {
  generation: number;
};

type BreadcrumbArguments<
  TSchema extends FlareSchema,
  TName extends keyof BreadcrumbsOf<TSchema>,
> =
  TSchema["breadcrumbs"] extends Record<string, unknown>
    ? undefined extends BreadcrumbsOf<TSchema>[TName]
      ? [data?: BreadcrumbsOf<TSchema>[TName], options?: BreadcrumbOptions]
      : [data: BreadcrumbsOf<TSchema>[TName], options?: BreadcrumbOptions]
    : [data?: BreadcrumbsOf<TSchema>[TName], options?: BreadcrumbOptions];

const toAmbient = (snapshot: SessionSnapshot): AmbientSnapshot =>
  Object.freeze({
    generation: snapshot.generation,
    user: snapshot.user,
    tags: snapshot.tags,
    contexts: snapshot.contexts,
  });

/**
 * Provider-independent error reporting. A `Flare` owns how a report is built,
 * isolated, sanitized, routed and handed to each destination. Constructing
 * one is cheap and starts nothing; `start()` opens the destinations, and
 * reports captured before that are buffered briefly.
 *
 * Nothing here throws into the application at runtime. A provider failure is
 * an outcome on the receipt, and only a misconfigured constructor throws.
 *
 * @example
 * ```ts
 * const flare = new Flare({
 *   destinations: { sentry: sentry({ sdk: Sentry }), console: consoleReporter() },
 *   default: ["sentry"],
 * });
 * flare.start();
 * flare.user({ id: "user_42" });
 * flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
 * ```
 */
export class Flare<
  TDestinations extends Destinations = Destinations,
  TSchema extends FlareSchema = FlareSchema,
> {
  #now: () => number;
  #policy: PrivacyPolicy;
  #schema: FlareSchema;
  #defaults: ReportLayer;
  #defaultDestinations: ReadonlyMap<
    DestinationName<TDestinations>,
    DestinationRuntime
  >;
  #route: FlareOptions<TDestinations, TSchema>["route"];
  #runtimes = new Map<DestinationName<TDestinations>, DestinationRuntime>();
  #status = new ValueStore<FlareStatus>(Object.freeze({ state: "idle" }));
  #session: SessionState;
  #dedupe: DedupeIndex;
  #rate: RateWindow;
  #diagnostics: Diagnostics;
  #pendingReceipts = 0;
  #submitDepth = 0;
  #ambient: AmbientSnapshot;
  #identityBeganAt = Number.NEGATIVE_INFINITY;

  constructor(options: FlareOptions<TDestinations, TSchema>) {
    this.#now = options.now ?? Date.now;
    this.#policy = {
      redact: options.privacy?.redact ?? DEFAULT_REDACT,
      scrub: options.privacy?.scrub ?? null,
      limits: { ...DEFAULT_LIMITS, ...options.privacy?.limits },
    };
    this.#schema = options.schema ?? {};
    const destinations = this.#readDestinations(options.destinations);
    this.#route = options.route;
    this.#session = new SessionState({
      maxBreadcrumbs: this.#policy.limits.breadcrumbs,
    });
    this.#ambient = toAmbient(this.#session.state.get());
    this.#dedupe = new DedupeIndex({ ...DEFAULT_DEDUPE, ...options.dedupe });
    this.#rate = new RateWindow({
      perMinute: options.limits?.reportsPerMinute ?? DEFAULT_REPORTS_PER_MINUTE,
    });
    this.#diagnostics = new Diagnostics({
      read: this.#readSnapshot,
      now: this.#now,
    });
    this.diagnostics = this.#diagnostics.api;
    this.#defaults = prepareReportLayer(options.defaults ?? {}, {
      schema: this.#schema,
      policy: this.#policy,
    }).layer;

    for (const [name, adapter] of destinations) {
      this.#runtimes.set(
        name,
        new DestinationRuntime({
          name,
          adapter,
          buffer: { ...DEFAULT_BUFFER, ...options.buffer },
          deadlineMs: options.deadlineMs ?? DEFAULT_DEADLINE_MS,
          now: this.#now,
          currentGeneration: () => this.#session.state.get().generation,
          readAmbient: () => this.#ambient,
          submitDepth: {
            enter: () => {
              this.#submitDepth += 1;
            },
            exit: () => {
              this.#submitDepth -= 1;
            },
          },
          record: this.#diagnostics.record,
          changed: this.#diagnostics.changed,
        }),
      );
    }

    const selected = options.default;
    if (selected !== undefined && this.#route !== undefined) {
      throw new Error("Flare accepts either default or route, not both.");
    }
    this.#defaultDestinations =
      selected === undefined
        ? this.#runtimes
        : this.#selectDestinations(selected);
    this.#session.state.subscribe(this.#handleSessionChange);
  }

  /** Whether the runtime is idle, started or disposed. Observing it starts nothing. */
  status: ObservableValue<FlareStatus> = {
    get: this.#status.get,
    subscribe: this.#status.subscribe,
  };

  /** Read-only view for devtools. Observing it starts nothing and creates no report. */
  diagnostics: FlareDiagnostics;

  /**
   * Opens every destination. Calling it again does nothing, except that a
   * destination whose start failed is tried again.
   *
   * @example
   * ```ts
   * flare.start();
   * ```
   */
  start = () => {
    if (this.#status.get().state === "disposed") {
      return;
    }

    // A later call only retries destinations whose start failed. The status
    // is already `started`, and observers compare it by identity.
    if (this.#status.get().state === "idle") {
      this.#status.set(Object.freeze({ state: "started" }));
      this.#diagnostics.record({
        source: "runtime",
        type: "started",
        destination: null,
        report: null,
        context: null,
      });
    }
    for (const runtime of this.#runtimes.values()) {
      runtime.start();
    }
    this.#diagnostics.changed();
  };

  /**
   * Sets who reports belong to, or `null` to sign out. A different `id`
   * starts a new identity generation: session tags, contexts and breadcrumbs
   * are cleared, and scopes created earlier become stale.
   *
   * @example
   * ```ts
   * flare.user({ id: "user_42", email: "ada@example.com" });
   * flare.user(null);
   * ```
   */
  user = (user: FlareUser | null) => {
    this.#guardSession("user", (generation) => {
      const prepared = prepareUser(user, this.#policy);
      this.#recordLosses(prepared.losses);
      if (!this.#isCurrentSession(generation)) {
        return;
      }
      const changed = this.#session.identify(prepared);
      if (!changed) {
        return;
      }
      this.#identityBeganAt = this.#now();
      this.#diagnostics.record({
        source: "session",
        type: "identity changed",
        destination: null,
        report: null,
        context: { generation: this.#session.state.get().generation },
      });
    });
  };

  /**
   * Sets a session tag, or removes it with `null`.
   *
   * @example
   * ```ts
   * flare.tag("area", "upload");
   * ```
   */
  tag = <TKey extends keyof TagsOf<TSchema> & string>(
    key: TKey,
    value: TagsOf<TSchema>[TKey] | null,
  ) => {
    this.#guardSession(`tags.${key}`, (generation) => {
      if (value === null) {
        this.#session.removeTag(key);
        return;
      }
      const prepared = prepareTags(
        { [key]: value },
        this.#schema.tags,
        this.#policy,
      );
      this.#recordLosses(prepared.losses);
      if (!this.#isCurrentSession(generation)) {
        return;
      }
      const tag = prepared.value[key];
      if (tag === undefined) {
        return;
      }
      this.#session.setTag(key, tag);
    });
  };

  /**
   * Sets a session context, or removes it with `null`. A context is replaced
   * as a whole, never merged with its previous value.
   *
   * @example
   * ```ts
   * flare.context("workspace", { id: "w_1", plan: "pro" });
   * ```
   */
  context = <TName extends keyof ContextsOf<TSchema> & string>(
    name: TName,
    value: ContextsOf<TSchema>[TName] | null,
  ) => {
    this.#guardSession(`contexts.${name}`, (generation) => {
      if (value === null) {
        this.#session.removeContext(name);
        return;
      }
      const prepared = prepareContexts(
        { [name]: value },
        this.#schema.contexts,
        this.#policy,
      );
      this.#recordLosses(prepared.losses);
      if (!this.#isCurrentSession(generation)) {
        return;
      }
      const context = prepared.value[name];
      if (context === undefined) {
        return;
      }
      this.#session.setContext(name, context);
    });
  };

  /**
   * Records one step of error-relevant history. It creates no report.
   * Breadcrumbs are sanitized before they are kept, bounded in number, and
   * cleared when the identity changes.
   *
   * @example
   * ```ts
   * flare.breadcrumb("uploadStarted", { kind: "avatar" });
   * ```
   */
  breadcrumb = <TName extends keyof BreadcrumbsOf<TSchema> & string>(
    name: TName,
    ...[data, options = {}]: BreadcrumbArguments<TSchema, TName>
  ) => {
    this.#guardSession(`breadcrumbs.${name}`, (generation) => {
      const occurredAt = this.#readOccurrence(options.timestamp);
      const timestamp = occurredAt ?? this.#now();
      // A backward clock must not reject a breadcrumb recorded under the current identity.
      if (occurredAt !== null && occurredAt < this.#identityBeganAt) {
        this.#diagnostics.record({
          source: "session",
          type: "breadcrumb stale",
          destination: null,
          report: null,
          context: { name },
        });
        return;
      }

      const prepared = prepareBreadcrumb(
        { name, data, timestamp },
        this.#schema.breadcrumbs,
        this.#policy,
      );
      this.#recordLosses(prepared.losses);
      if (!this.#isCurrentSession(generation)) {
        return;
      }
      const breadcrumb = prepared.value;
      if (breadcrumb === null) {
        return;
      }
      this.#session.addBreadcrumb(breadcrumb);
      for (const runtime of this.#runtimes.values()) {
        if (!this.#isCurrentSession(generation)) {
          return;
        }
        runtime.ambientBreadcrumb(breadcrumb);
      }
    });
  };

  /**
   * Binds metadata to one operation. The scope belongs to the identity it is
   * created under and goes stale when that identity changes.
   *
   * @example
   * ```ts
   * const upload = flare.scope({ tags: { area: "upload" }, operation: "upload-avatar" });
   * upload.capture(error);
   * ```
   */
  scope: {
    // A method signature, for the reason given on `ReportFunction`.
    bivariant(
      options: ReportOptions<TSchema>,
    ): FlareScope<DestinationName<TDestinations>, TSchema>;
  }["bivariant"] = (options) => {
    const generation = this.#session.state.get().generation;
    const bound = this.#bindScope(generation, options);
    return {
      capture: (thrown, captureOptions = {}) =>
        this.#report({ kind: "exception", thrown }, captureOptions, bound),
      message: (text, captureOptions = {}) =>
        this.#report({ kind: "message", text }, captureOptions, bound),
    };
  };

  /**
   * Reports a failure. It is synchronous and never throws. Most callers
   * ignore the receipt.
   *
   * @example
   * ```ts
   * try {
   *   await save();
   * } catch (error) {
   *   flare.capture(error);
   * }
   * ```
   */
  capture: ReportFunction<unknown, DestinationName<TDestinations>, TSchema> = (
    thrown,
    options = {},
  ) => this.#report({ kind: "exception", thrown }, options, null);

  /**
   * Reports an abnormal condition that is not an exception.
   *
   * @example
   * ```ts
   * flare.message("Unexpected payment state", { level: "warning" });
   * ```
   */
  message: ReportFunction<string, DestinationName<TDestinations>, TSchema> = (
    text,
    options = {},
  ) => this.#report({ kind: "message", text }, options, null);

  /**
   * Waits for the work accepted before the call, then for each provider's own
   * flush. Captures made afterwards do not extend the wait. The timeout bounds
   * the wait only: it cancels nothing and proves nothing about delivery.
   *
   * @example
   * ```ts
   * await flare.flush({ timeoutMs: 1500 });
   * ```
   */
  flush = async ({
    timeoutMs = DEFAULT_FLUSH_TIMEOUT_MS,
  }: { timeoutMs?: number } = {}): Promise<
    FlareFlushResult<DestinationName<TDestinations>>
  > => {
    const results = await Promise.all(
      [...this.#runtimes].map(async ([name, runtime]) => ({
        name,
        ...(await runtime.flush(timeoutMs)),
      })),
    );

    const destinations: FlareFlushResult<
      DestinationName<TDestinations>
    >["destinations"] = Object.create(null);
    for (const result of results) {
      destinations[result.name] = result.boundary;
    }
    this.#diagnostics.record({
      source: "runtime",
      type: "flushed",
      destination: null,
      report: null,
      context: { timeoutMs },
    });
    return { drained: results.every((result) => result.drained), destinations };
  };

  /**
   * The escape hatch to one destination. Reading it is passive. Calls made
   * on `native` bypass Flare's routing, receipts and privacy guarantees.
   *
   * @example
   * ```ts
   * flare.destination("sentry").native?.addBreadcrumb({ message: "outside Flare" });
   * ```
   */
  destination = <TName extends DestinationName<TDestinations>>(
    name: TName,
  ): DestinationHandle<NativeOf<TDestinations>[TName]> => {
    const runtime = this.#runtimes.get(name);
    if (runtime === undefined) {
      throw new Error(`Flare has no destination named "${name}".`);
    }

    return Object.freeze({
      capabilities: runtime.capabilities,
      status: runtime.status,
      get native() {
        // Enumerating the destinations erased which native handle belongs to
        // which name; the adapter registered under `name` is what produced it.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return runtime.native as NativeOf<TDestinations>[TName] | null;
      },
    });
  };

  /** Synchronously releases every destination. Repeated calls do nothing. */
  dispose = () => {
    if (this.#status.get().state === "disposed") {
      return;
    }

    this.#status.set(Object.freeze({ state: "disposed" }));
    for (const runtime of this.#runtimes.values()) {
      runtime.dispose();
    }
    this.#diagnostics.dispose();
  };

  #readOccurrence(timestamp: unknown) {
    if (typeof timestamp !== "number") {
      return null;
    }
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      return null;
    }
    return timestamp;
  }

  #readDestinations(destinations: TDestinations) {
    const adapters = new Map<DestinationName<TDestinations>, ReporterAdapter>();
    const owners = new Map<unknown, string>();
    const singletons = new Map<object, string>();
    for (const name in destinations) {
      if (!Object.hasOwn(destinations, name)) {
        continue;
      }
      const adapter = destinations[name];
      if (adapter === undefined) {
        continue;
      }
      const owner = owners.get(adapter);
      if (owner !== undefined) {
        throw new Error(
          `Flare destinations "${owner}" and "${name}" share one adapter. Create one adapter per destination.`,
        );
      }
      owners.set(adapter, name);
      this.#claimSingleton(singletons, adapter.singleton, name);
      adapters.set(name, adapter);
    }
    return adapters;
  }

  // A process-wide SDK reports every event it is given: registered twice, it reports twice.
  #claimSingleton(
    singletons: Map<object, string>,
    singleton: object | undefined,
    name: string,
  ) {
    if (singleton === undefined) {
      return;
    }

    const owner = singletons.get(singleton);
    if (owner !== undefined) {
      throw new Error(
        `Flare destinations "${owner}" and "${name}" drive the same singleton SDK. Register it once.`,
      );
    }
    singletons.set(singleton, name);
  }

  #selectDestinations(names: readonly DestinationName<TDestinations>[]) {
    const destinations = new Map<
      DestinationName<TDestinations>,
      DestinationRuntime
    >();
    for (const name of names) {
      const runtime = this.#runtimes.get(name);
      if (runtime === undefined) {
        throw new Error(`Flare has no destination named "${String(name)}".`);
      }
      destinations.set(name, runtime);
    }
    return destinations;
  }

  #readSnapshot = (): FlareSnapshot => {
    const session = this.#session.state.get();
    return Object.freeze({
      status: this.#status.get(),
      generation: session.generation,
      breadcrumbs: session.breadcrumbs.length,
      pendingReceipts: this.#pendingReceipts,
      destinations: Object.freeze(
        [...this.#runtimes.values()].map((runtime) =>
          Object.freeze({
            name: runtime.name,
            adapter: runtime.adapter.name,
            status: runtime.status.get(),
            capabilities: runtime.capabilities,
            buffered: runtime.buffered,
            inFlight: runtime.inFlight,
          }),
        ),
      ),
    });
  };

  // Breadcrumbs change the session too, but they reach providers one by one.
  #handleSessionChange = () => {
    this.#diagnostics.changed();
    const current = this.#session.state.get();
    const previous = this.#ambient;
    if (
      current.generation === previous.generation &&
      current.user === previous.user &&
      current.tags === previous.tags &&
      current.contexts === previous.contexts
    ) {
      return;
    }

    const next = toAmbient(current);
    this.#ambient = next;
    for (const runtime of this.#runtimes.values()) {
      // A provider callback may already have mirrored a newer snapshot to everyone.
      if (this.#ambient !== next) {
        return;
      }
      runtime.syncAmbient(next);
    }
  };

  // A scrubber that throws must cost the data it was given, never the host.
  #guardSession(path: string, change: (generation: number) => void) {
    if (this.#status.get().state === "disposed") {
      return;
    }

    try {
      change(this.#session.state.get().generation);
    } catch {
      this.#diagnostics.record({
        source: "session",
        type: "session change rejected",
        destination: null,
        report: null,
        context: { path },
      });
    }
  }

  // Validators, scrubbers and diagnostic listeners can change the account while data is prepared.
  #isCurrentSession(generation: number) {
    return (
      this.#status.get().state !== "disposed" &&
      this.#session.state.get().generation === generation
    );
  }

  #recordLosses(losses: readonly MappingLoss[]) {
    if (losses.length === 0) {
      return;
    }
    this.#diagnostics.record({
      source: "session",
      type: "session losses",
      destination: null,
      report: null,
      context: { losses },
    });
  }

  #bindScope(generation: number, options: ReportOptions<TSchema>): BoundScope {
    try {
      return {
        generation,
        ...prepareReportLayer(options, {
          schema: this.#schema,
          policy: this.#policy,
        }),
      };
    } catch {
      // Failing closed: a scope that could not be sanitized contributes nothing.
      return {
        generation,
        layer: {},
        losses: [{ path: "scope", reason: "invalid" }],
      };
    }
  }

  #refusal(scope: BoundScope | null): ReportDropReason | null {
    if (this.#status.get().state === "disposed") {
      return "disposed";
    }

    if (this.#submitDepth > 0) {
      return "reentrant";
    }

    const admission = this.#rate.admit(this.#now());
    if (admission !== "admitted") {
      if (admission === "refused-first") {
        this.#diagnostics.record({
          source: "report",
          type: "rate limit reached",
          destination: null,
          report: null,
          context: null,
        });
      }
      return "rate-limited";
    }

    if (scope === null) {
      return null;
    }

    if (scope.generation !== this.#session.state.get().generation) {
      return "stale-scope";
    }
    return null;
  }

  #build(
    id: string,
    source: ReportSource,
    options: ReportOptions<TSchema>,
    scope: BoundScope | null,
  ): SanitizedReport {
    const session = this.#session.state.get();
    const payload = prepareReportPayload(source, this.#policy);
    const prepared = prepareReportLayer(options, {
      schema: this.#schema,
      policy: this.#policy,
    });
    const report = composeReport({
      id,
      timestamp: this.#now(),
      payload: payload.payload,
      defaults: this.#defaults,
      session,
      scope: scope === null ? null : scope.layer,
      options: prepared.layer,
      losses: [
        ...payload.losses,
        ...(scope === null ? [] : scope.losses),
        ...prepared.losses,
      ],
    });
    return fitReport(report, this.#policy.limits.totalSize);
  }

  #resolveRoute(
    report: SanitizedReport,
    options: CaptureOptions<DestinationName<TDestinations>, TSchema>,
  ) {
    try {
      let selected = options.to;
      if (selected === undefined) {
        if (typeof this.#route !== "function") {
          return this.#defaultDestinations;
        }
        selected = this.#route({ report });
      }
      if (!Array.isArray(selected)) {
        return null;
      }

      return this.#selectDestinations(selected);
    } catch {
      // Routing is a privacy boundary, including reading and iterating its result.
      return null;
    }
  }

  #report(
    source: ReportSource,
    options: CaptureOptions<DestinationName<TDestinations>, TSchema>,
    scope: BoundScope | null,
  ): Receipt<DestinationName<TDestinations>> {
    const id = createReportId();
    const drop = (reason: ReportDropReason) => {
      const dropped = createReceipt<DestinationName<TDestinations>>(id, []);
      dropped.drop(reason);
      this.#diagnostics.record({
        source: "report",
        type: "report dropped",
        destination: null,
        report: id,
        context: { reason },
      });
      return dropped.receipt;
    };

    const refusal = this.#refusal(scope);
    if (refusal !== null) {
      return drop(refusal);
    }

    let report: SanitizedReport;
    let dedupeKey: string | null;
    try {
      report = this.#build(id, source, options, scope);
      const key = options.dedupe?.key;
      dedupeKey = typeof key === "string" ? key : null;
    } catch {
      // Privacy outranks delivery: what could not be sanitized is not sent.
      return drop("sanitizer-failed");
    }

    const destinations = this.#resolveRoute(report, options);
    if (destinations === null) {
      return drop("route-failed");
    }
    if (destinations.size === 0) {
      return drop("no-destinations");
    }

    const names = [...destinations.keys()];
    const { receipt, settle } = createReceipt(id, names);
    this.#pendingReceipts += 1;
    receipt.settled.then(() => {
      this.#pendingReceipts -= 1;
      this.#diagnostics.changed();
    });
    this.#diagnostics.record({
      source: "report",
      type: "report accepted",
      destination: null,
      report: id,
      context: {
        kind: report.kind,
        destinations: names,
        losses: report.losses.length,
      },
    });

    const thrown = source.kind === "exception" ? source.thrown : undefined;
    for (const [name, runtime] of destinations) {
      const duplicate = this.#dedupe.isDuplicate({
        destination: name,
        generation: report.identity.generation,
        key: dedupeKey,
        thrown,
        now: this.#now(),
      });
      if (duplicate) {
        const outcome = { status: "dropped", reason: "deduped" } as const;
        settle(name, outcome);
        this.#diagnostics.record({
          source: "destination",
          type: "destination outcome",
          destination: name,
          report: id,
          context: describeOutcome(outcome),
        });
        continue;
      }
      runtime.accept({
        report,
        settle: (outcome) => settle(name, outcome),
      });
    }

    this.#diagnostics.changed();
    return receipt;
  }
}
