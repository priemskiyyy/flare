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
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SessionSnapshot } from "src/types/SessionSnapshot";
import type { TagsOf } from "src/types/TagsOf";
import { ValueStore } from "src/utils/common/ValueStore";
import {
  DEFAULT_BUFFER,
  DEFAULT_DEDUPE_WINDOW,
  DEFAULT_FLUSH_TIMEOUT,
  DEFAULT_REPORTS_PER_MINUTE,
  DEFAULT_TIMEOUT,
  MAX_DEDUPE_KEYS,
} from "src/utils/constants/defaults";
import {
  DISPOSED_FLARE_STATUS,
  IDLE_FLARE_STATUS,
  STARTED_FLARE_STATUS,
} from "src/utils/constants/status";
import { FlareError } from "src/utils/FlareError";
import { isSensitiveKey } from "src/utils/isSensitiveKey";
import { DestinationRuntime } from "src/utils/internal/destinations/DestinationRuntime";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";
import { createReceipt } from "src/utils/internal/dispatch/createReceipt";
import { RateWindow } from "src/utils/internal/dispatch/RateWindow";
import { prepareBreadcrumb } from "src/utils/internal/intake/prepareBreadcrumb";
import { prepareContexts } from "src/utils/internal/intake/prepareContexts";
import { prepareReportLayer } from "src/utils/internal/intake/prepareReportLayer";
import { prepareReportPayload } from "src/utils/internal/intake/prepareReportPayload";
import { prepareTags } from "src/utils/internal/intake/prepareTags";
import { prepareUser } from "src/utils/internal/intake/prepareUser";
import { clampTimeout } from "src/utils/internal/options/clampTimeout";
import { resolveCount } from "src/utils/internal/options/resolveCount";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";
import { resolveLimits } from "src/utils/internal/options/resolveLimits";
import { composeReport } from "src/utils/internal/report/composeReport";
import { createReportId } from "src/utils/internal/report/createReportId";
import { fitReport } from "src/utils/internal/report/fitReport";
import { SessionState } from "src/utils/internal/session/SessionState";

type BoundScope = ReturnType<typeof prepareReportLayer> & {
  generation: number;
};

type DefaultTo<TDestinations extends Destinations> = NonNullable<
  FlareOptions<TDestinations>["defaults"]
>["to"];

type BreadcrumbArguments<
  TSchema extends FlareSchema,
  TName extends keyof BreadcrumbsOf<TSchema>,
> =
  TSchema["breadcrumbs"] extends Record<string, unknown>
    ? undefined extends BreadcrumbsOf<TSchema>[TName]
      ? [data?: BreadcrumbsOf<TSchema>[TName], options?: BreadcrumbOptions]
      : [data: BreadcrumbsOf<TSchema>[TName], options?: BreadcrumbOptions]
    : [data?: BreadcrumbsOf<TSchema>[TName], options?: BreadcrumbOptions];

const createAmbientSnapshot = (snapshot: SessionSnapshot): AmbientSnapshot =>
  Object.freeze({
    generation: snapshot.generation,
    user: snapshot.user,
    tags: snapshot.tags,
    contexts: snapshot.contexts,
  });

const UNSCOPED = Object.freeze({
  layer: Object.freeze({}),
  losses: Object.freeze([]),
});

// Report data is made of ordinary objects, where a name the data lacks would
// otherwise read whatever Object.prototype holds under it.
const getOwnValue = <TValue>(
  record: Readonly<Record<string, TValue>>,
  key: string,
) => {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }

  return record[key];
};

// Only an exception has a thrown value that dedupe can recognize again.
const getDedupeSubject = (source: ReportSource) => {
  if (source.kind === "exception") {
    return source.thrown;
  }

  return undefined;
};

// The clock is application code too: one that throws, or answers no number,
// gives way to the system clock rather than to an exception.
const createContainedClock = (now: () => number) => () => {
  let time: unknown;

  try {
    time = now();
  } catch {
    return Date.now();
  }

  if (typeof time !== "number" || !Number.isFinite(time)) {
    return Date.now();
  }

  return time;
};

// The last time a Date can hold. Every provider turns a breadcrumb's time
// into one, and a later time would make that throw.
const MAX_DATE_MS = 8.64e15;

// NaN, the infinities, negative numbers and times past the last Date are not
// points in time a provider can record.
const getBreadcrumbTime = (timestamp: number | undefined) => {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return null;
  }

  if (timestamp < 0 || timestamp > MAX_DATE_MS) {
    return null;
  }

  return timestamp;
};

/**
 * Provider-independent error reporting. A `Flare` owns how a report is built,
 * isolated, sanitized, routed and handed to each destination. Constructing
 * one is cheap and starts nothing; `start()` opens the destinations, and
 * reports captured before that are buffered briefly.
 *
 * Nothing here throws into the application at runtime. A provider failure is
 * an outcome on the receipt, and only misconfiguration throws: the
 * constructor, and `destination()` for a name that was never configured.
 *
 * @example
 * ```ts
 * const flare = new Flare({
 *   destinations: { sentry: sentry({ sdk: Sentry }), console: console() },
 *   defaults: { to: ["sentry"] },
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
  // What the defaults lost to their bounds, which every report inherits.
  #defaultLosses: readonly MappingLoss[];
  #defaultTo: DefaultTo<TDestinations>;
  #runtimes = new Map<DestinationName<TDestinations>, DestinationRuntime>();
  #defaultDestinations: ReadonlyMap<
    DestinationName<TDestinations>,
    DestinationRuntime
  >;
  #status = new ValueStore<FlareStatus>(IDLE_FLARE_STATUS);
  #session: SessionState;
  #rate: RateWindow;
  #diagnostics: Diagnostics;
  #pendingReceipts = 0;
  #submitDepth = 0;
  #ambient: AmbientSnapshot;
  #identityBeganAt = Number.NEGATIVE_INFINITY;

  constructor({
    destinations,
    schema,
    defaults = {},
    privacy = {},
    buffer,
    timeout,
    dedupe,
    rateLimits,
    now: readNow = Date.now,
  }: FlareOptions<TDestinations, TSchema>) {
    const now = createContainedClock(readNow);

    const { redact = isSensitiveKey, scrub = null } = privacy;

    if (typeof redact !== "function") {
      throw new FlareError({
        code: "INVALID_CONFIGURATION",
        message: "privacy.redact must be a function.",
      });
    }

    if (scrub !== null && typeof scrub !== "function") {
      throw new FlareError({
        code: "INVALID_CONFIGURATION",
        message: "privacy.scrub must be a function.",
      });
    }

    this.#now = now;
    this.#policy = {
      redact,
      scrub,
      limits: resolveLimits(privacy.limits),
    };
    this.#schema = schema ?? {};
    this.#defaultTo = defaults.to;
    this.#session = new SessionState({
      maxBreadcrumbs: this.#policy.limits.breadcrumbs,
    });
    this.#ambient = createAmbientSnapshot(this.#session.state.get());
    this.#rate = new RateWindow({
      perMinute: resolveCount(
        "rateLimits.perMinute",
        rateLimits?.perMinute,
        DEFAULT_REPORTS_PER_MINUTE,
      ),
    });
    this.#diagnostics = new Diagnostics({ read: this.#readSnapshot, now });
    this.diagnostics = this.#diagnostics.api;

    const prepared = this.#prepareDefaults(defaults);
    const invalid = prepared.losses.filter((loss) => loss.reason === "invalid");

    if (invalid.length > 0) {
      const paths = invalid.map((loss) => loss.path).join(", ");

      throw new FlareError({
        code: "INVALID_CONFIGURATION",
        message: `Flare's defaults are invalid at ${paths}.`,
      });
    }

    this.#defaults = prepared.layer;
    this.#defaultLosses = prepared.losses;

    const runtime = {
      buffer: {
        capacity: resolveCount(
          "buffer.capacity",
          buffer?.capacity,
          DEFAULT_BUFFER.capacity,
        ),
        maxAge: resolveDuration(
          "buffer.maxAge",
          buffer?.maxAge,
          DEFAULT_BUFFER.maxAge,
        ),
      },
      dedupe: {
        window: resolveDuration(
          "dedupe.window",
          dedupe?.window,
          DEFAULT_DEDUPE_WINDOW,
        ),
        maxKeys: MAX_DEDUPE_KEYS,
      },
      timeout: resolveDuration("timeout", timeout, DEFAULT_TIMEOUT),
      now,
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
    };

    for (const name in destinations) {
      if (!Object.hasOwn(destinations, name)) {
        continue;
      }

      const adapter = destinations[name];

      if (adapter === undefined) {
        continue;
      }

      this.#runtimes.set(
        name,
        new DestinationRuntime({ ...runtime, name, adapter }),
      );
    }

    this.#defaultDestinations = this.#selectDefault(this.#defaultTo);
    this.#session.state.subscribe(this.#handleSessionChange);
  }

  /** Whether the runtime is idle, started or disposed. Observing it starts nothing. */
  status: ObservableValue<FlareStatus> = this.#status.observable;

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
    const { state } = this.#status.get();

    if (state === "disposed") {
      return;
    }

    // A later call only retries destinations whose start failed, and tells
    // no status observer anything, because nothing about the runtime changed.
    if (state === "idle") {
      this.#status.set(STARTED_FLARE_STATUS);
      this.#diagnostics.record({ source: "runtime", type: "started" });
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

      if (!this.#session.identify(prepared)) {
        return;
      }

      this.#identityBeganAt = this.#now();
      this.#diagnostics.record({
        source: "session",
        type: "identity changed",
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

      const tag = getOwnValue(prepared.value, key);

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

      const context = getOwnValue(prepared.value, name);

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
      const occurredAt = getBreadcrumbTime(options.timestamp);

      // A backward clock must not reject a breadcrumb recorded under the current identity.
      if (occurredAt !== null && occurredAt < this.#identityBeganAt) {
        this.#diagnostics.record({
          source: "session",
          type: "breadcrumb stale",
        });

        return;
      }

      const prepared = prepareBreadcrumb(
        { name, data, timestamp: occurredAt ?? this.#now() },
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
    const bound = this.#bindScope(options);

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
   * await flare.flush({ timeout: 1500 });
   * ```
   */
  flush = async ({
    timeout = DEFAULT_FLUSH_TIMEOUT,
  }: { timeout?: number } = {}): Promise<
    FlareFlushResult<DestinationName<TDestinations>>
  > => {
    const results = await Promise.all(
      [...this.#runtimes].map(async ([name, runtime]) => ({
        name,
        ...(await runtime.flush(clampTimeout(timeout))),
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
      context: { timeout },
    });

    return Object.freeze({
      drained: results.every((result) => result.drained),
      destinations: Object.freeze(destinations),
    });
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
      throw new FlareError({
        code: "INVALID_CONFIGURATION",
        message: `Flare has no destination named "${name}".`,
      });
    }

    return Object.freeze({
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

    this.#status.set(DISPOSED_FLARE_STATUS);

    for (const runtime of this.#runtimes.values()) {
      runtime.dispose();
    }

    this.#diagnostics.dispose();
  };

  // A list is where reports go unless `to` says otherwise. Omitted, or a
  // function that decides per report, it is every destination.
  #selectDefault(to: DefaultTo<TDestinations>) {
    if (to === undefined || typeof to === "function") {
      return this.#runtimes;
    }

    return this.#selectDestinations(to);
  }

  #selectDestinations(names: readonly DestinationName<TDestinations>[]) {
    const destinations = new Map<
      DestinationName<TDestinations>,
      DestinationRuntime
    >();

    for (const name of names) {
      const runtime = this.#runtimes.get(name);

      if (runtime === undefined) {
        throw new FlareError({
          code: "INVALID_CONFIGURATION",
          message: `Flare has no destination named "${String(name)}".`,
        });
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
            adapter: runtime.adapterName,
            status: runtime.currentStatus,
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

    const next = createAmbientSnapshot(current);

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
      context: { losses },
    });
  }

  // A scrubber that throws on the defaults is misconfiguration, which is the
  // one thing that throws, as a FlareError that keeps what went wrong.
  #prepareDefaults(defaults: ReportOptions<TSchema>) {
    try {
      return prepareReportLayer(defaults, {
        schema: this.#schema,
        policy: this.#policy,
      });
    } catch (error) {
      throw new FlareError({
        code: "INVALID_CONFIGURATION",
        message: "Flare's defaults could not be sanitized.",
        cause: error,
      });
    }
  }

  #bindScope(options: ReportOptions<TSchema>): BoundScope {
    const { generation } = this.#session.state.get();

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

    // Before the rate budget: a stale report spends none of it.
    if (
      scope !== null &&
      scope.generation !== this.#session.state.get().generation
    ) {
      return "stale-scope";
    }

    const admission = this.#rate.admit(this.#now());

    if (admission === "refused-first") {
      this.#diagnostics.record({
        source: "report",
        type: "rate limit reached",
      });
    }

    if (admission !== "admitted") {
      return "rate-limited";
    }

    return null;
  }

  #build(
    id: string,
    source: ReportSource,
    options: ReportOptions<TSchema>,
    scope: BoundScope | null,
  ): SanitizedReport {
    // Read before intake runs application validators and scrubbers, which
    // could otherwise relabel this report by switching accounts.
    const session = this.#session.state.get();
    const scoped = scope ?? UNSCOPED;
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
      scope: scoped.layer,
      options: prepared.layer,
      losses: [
        ...payload.losses,
        ...this.#defaultLosses,
        ...scoped.losses,
        ...prepared.losses,
      ],
    });

    return fitReport(report, this.#policy.limits.totalSize);
  }

  // Routing fails closed: a `to` that throws or names an unknown
  // destination sends the report nowhere rather than somewhere unintended.
  #resolveRoute(
    report: SanitizedReport,
    to: readonly DestinationName<TDestinations>[] | undefined,
  ) {
    try {
      if (to !== undefined) {
        return this.#selectDestinations(to);
      }

      if (typeof this.#defaultTo !== "function") {
        return this.#defaultDestinations;
      }

      return this.#selectDestinations(this.#defaultTo({ report }));
    } catch {
      return null;
    }
  }

  #drop(id: string, reason: ReportDropReason) {
    const { receipt, drop } = createReceipt<DestinationName<TDestinations>>(
      id,
      [],
    );

    drop(reason);
    this.#diagnostics.record({
      source: "report",
      type: "report dropped",
      report: id,
      context: { reason },
    });

    return receipt;
  }

  #report(
    source: ReportSource,
    options: CaptureOptions<DestinationName<TDestinations>, TSchema>,
    scope: BoundScope | null,
  ): Receipt<DestinationName<TDestinations>> {
    const id = createReportId();
    const refusal = this.#refusal(scope);

    if (refusal !== null) {
      return this.#drop(id, refusal);
    }

    let to: readonly DestinationName<TDestinations>[] | undefined;
    let key: string | null;
    let report: SanitizedReport;

    try {
      // The caller's getters, read once and contained like the rest of intake.
      to = options.to;
      key = options.dedupe?.key ?? null;
      report = this.#build(id, source, options, scope);
    } catch {
      // Privacy outranks delivery: what could not be sanitized is not sent.
      return this.#drop(id, "sanitizer-failed");
    }

    const destinations = this.#resolveRoute(report, to);

    if (destinations === null) {
      return this.#drop(id, "route-failed");
    }

    if (destinations.size === 0) {
      return this.#drop(id, "no-destinations");
    }

    return this.#dispatch(report, destinations, {
      key,
      thrown: getDedupeSubject(source),
    });
  }

  #dispatch(
    report: SanitizedReport,
    destinations: ReadonlyMap<
      DestinationName<TDestinations>,
      DestinationRuntime
    >,
    occurrence: { key: string | null; thrown: unknown },
  ) {
    const names = [...destinations.keys()];

    // Counted down as the receipt finishes, not a tick later, so the snapshot
    // disposal freezes counts nothing that disposal settled.
    const { receipt, settle } = createReceipt(report.id, names, () => {
      this.#pendingReceipts -= 1;
      this.#diagnostics.changed();
    });

    this.#pendingReceipts += 1;
    this.#diagnostics.record({
      source: "report",
      type: "report accepted",
      report: report.id,
      context: {
        kind: report.kind,
        destinations: names,
        losses: report.losses.length,
      },
    });

    for (const [name, runtime] of destinations) {
      runtime.accept(
        { report, settle: (outcome) => settle(name, outcome) },
        occurrence,
      );
    }

    this.#diagnostics.changed();

    return receipt;
  }
}
