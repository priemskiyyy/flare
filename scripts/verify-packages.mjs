import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.join(workspace, ".artifacts");
const release = path.join(artifacts, "release");
const consumer = mkdtempSync(path.join(tmpdir(), "flare-consumer-"));

const rootPackage = JSON.parse(
  readFileSync(path.join(workspace, "package.json"), "utf8"),
);

const run = (command, args, cwd = consumer) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 300_000,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
      { cause: result.error },
    );
  }

  return result.stdout;
};

const write = (name, content) =>
  writeFileSync(path.join(consumer, name), content);

const json = (name, value) =>
  write(name, `${JSON.stringify(value, null, 2)}\n`);

// Copies a packed tarball with its checksum into the directory the publish
// workflow uploads as the release artifact.
const stageRelease = (name, tarball) => {
  const directory = path.join(release, name);
  const filename = path.basename(tarball);

  const checksum = createHash("sha256")
    .update(readFileSync(tarball))
    .digest("hex");

  mkdirSync(directory, { recursive: true });
  copyFileSync(tarball, path.join(directory, filename));
  writeFileSync(
    path.join(directory, "SHA256SUMS"),
    `${checksum}  ${filename}\n`,
  );
};

const read = (file) =>
  readFileSync(path.join(consumer, "node_modules", file), "utf8");

const packages = ["packages", "packages/adapters"].flatMap((group) =>
  readdirSync(path.join(workspace, group))
    .filter((directory) =>
      existsSync(path.join(workspace, group, directory, "package.json")),
    )
    .map((directory) => {
      const packageDirectory = path.join(workspace, group, directory);

      const manifest = JSON.parse(
        readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
      );

      return { group, directory: packageDirectory, manifest };
    }),
);

// A manifest cannot say which entries are client modules, so they are listed.
const clientEntries = [
  "@priemskiyyy/flare-react/dist/index.js",
  "@priemskiyyy/flare-devtools/dist/react.js",
];

// An adapter is handed its SDK by the application, so its bundle imports no
// optional peer: not the peer's scope, or the peer itself when it has none.
const getProviderPrefixes = ({ group, manifest }) => {
  if (group !== "packages/adapters") {
    return [];
  }

  return Object.keys(manifest.peerDependenciesMeta ?? {}).map((name) => {
    if (name.startsWith("@")) {
      return `${name.split("/")[0]}/`;
    }

    return name;
  });
};

// Every published entry. Svelte ships its sources unbundled, for the
// application's own compiler, under its own condition.
const bundles = packages.flatMap((entry) =>
  Object.values(entry.manifest.exports).map((target) => {
    const file = path.posix.join(
      entry.manifest.name,
      target.import ?? target.svelte,
    );

    return {
      file,
      client: clientEntries.includes(file),
      sdks: getProviderPrefixes(entry),
    };
  }),
);

// A real import or re-export, not the word in a JSDoc example.
const importsFrom = (bundle, prefix) =>
  new RegExp(
    `^\\s*(?:import|export)[^\\n]*from\\s+"${prefix}|import\\("${prefix}|require\\("${prefix}`,
    "m",
  ).test(bundle);

try {
  rmSync(release, { recursive: true, force: true });
  mkdirSync(artifacts, { recursive: true });

  const tarballs = packages.map(({ directory: packageDirectory, manifest }) => {
    process.stdout.write(
      run("pnpm", ["exec", "publint", packageDirectory], workspace),
    );

    const [packed] = JSON.parse(
      run(
        "npm",
        ["pack", "--ignore-scripts", "--json", "--pack-destination", artifacts],
        packageDirectory,
      ),
    );

    assert(packed.files.some((file) => file.path === "README.md"));
    assert(packed.files.some((file) => file.path === "LICENSE"));
    assert(!packed.files.some((file) => file.path.startsWith("src/")));
    assert(
      !packed.files.some((file) =>
        /\.(test|fixture|contracts)\./.test(file.path),
      ),
    );

    // pnpm rewrites `workspace:*` only when it publishes. A tarball that
    // still carries it cannot be installed by anyone.
    for (const field of ["dependencies", "peerDependencies"]) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        assert(
          !String(range).startsWith("workspace:"),
          `${manifest.name} publishes ${name} as ${range}.`,
        );
      }
    }

    const tarball = path.join(artifacts, packed.filename);

    stageRelease(packed.name, tarball);

    return tarball;
  });

  json("package.json", {
    name: "flare-package-consumer",
    private: true,
    type: "module",
    dependencies: {
      ...Object.fromEntries(
        [
          "react",
          "react-dom",
          "@types/react",
          "@types/react-dom",
          "vue",
          "solid-js",
          "svelte",
          "typescript",
        ].map((name) => [name, rootPackage.devDependencies[name]]),
      ),
      // Svelte's declarations import esrap's, which since esrap 2.3.10 import
      // this optional peer; a consumer that checks library types needs it. It
      // ships in lockstep with typescript-eslint.
      "@typescript-eslint/types":
        rootPackage.devDependencies["typescript-eslint"],
    },
  });
  process.stdout.write(
    "Installing packed packages in an isolated consumer...\n",
  );
  run("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...tarballs,
  ]);

  for (const { file, client, sdks } of bundles) {
    const bundle = read(file);

    assert(!bundle.includes('from "src/'), `${file} kept a src alias import.`);
    assert.equal(
      bundle.startsWith('"use client";'),
      client,
      `${file} has the wrong "use client" state.`,
    );
    // Default exports break silently under some React Native interop.
    assert(!/^export default /m.test(bundle), `${file} has a default export.`);

    for (const sdk of sdks) {
      assert(!importsFrom(bundle, sdk), `${file} imports ${sdk}.`);
    }
  }

  // Exactly one copy of the core, and one of the inspector, however many
  // packages build on them.
  for (const { manifest } of packages) {
    if (manifest.name === "@priemskiyyy/flare") {
      continue;
    }

    assert(
      !existsSync(
        path.join(
          consumer,
          "node_modules",
          manifest.name,
          "node_modules/@priemskiyyy/flare",
        ),
      ),
      `${manifest.name} installed its own copy of the core.`,
    );
  }

  for (const wrapper of ["react", "vue", "solid", "svelte"]) {
    assert(
      !read(`@priemskiyyy/flare-devtools/dist/${wrapper}.js`).includes(
        "already mounted",
      ),
      `The devtools ${wrapper} wrapper bundled a second inspector.`,
    );
  }

  // The inspector carries its own Solid runtime, so a host needs none.
  assert(
    !importsFrom(read("@priemskiyyy/flare-devtools/dist/index.js"), "solid-js"),
    "The inspector imports solid-js instead of bundling it.",
  );

  const declarations = read("@priemskiyyy/flare/dist/index.d.ts");

  assert(
    declarations.includes("@example"),
    "Declarations lost their examples.",
  );
  assert(
    !/DestinationRuntime|SessionState|DedupeIndex|RateWindow|PrivacyPolicy|ReportLayer/.test(
      declarations,
    ),
    "Core declarations expose an internal name.",
  );

  json("tsconfig.json", {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      skipLibCheck: false,
      noEmit: true,
    },
    include: ["*.ts", "*.tsx"],
  });

  write(
    "contracts.tsx",
    `import { Flare, isSensitiveKey, SanitizedError } from "@priemskiyyy/flare";
import type { FlareSchema, Receipt, ReporterAdapter, SanitizedReport, StandardSchema } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import type { MockSession } from "@priemskiyyy/flare/mock";
import { console } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";
import { sentry } from "@priemskiyyy/flare-sentry";
import { bugsnag } from "@priemskiyyy/flare-bugsnag";
import { crashlytics } from "@priemskiyyy/flare-crashlytics";
import { posthog } from "@priemskiyyy/flare-posthog";
import { posthog as posthogReactNative } from "@priemskiyyy/flare-posthog-react-native";
import { datadog } from "@priemskiyyy/flare-datadog";
import { datadog as datadogReactNative } from "@priemskiyyy/flare-datadog-react-native";
import { datadogLogs } from "@priemskiyyy/flare-datadog-logs";
import { opentelemetry } from "@priemskiyyy/flare-opentelemetry";
import { traceBreadcrumbs } from "@priemskiyyy/flare-trace";
import type { TraceEventSource } from "@priemskiyyy/flare-trace";
import { FlareDevtools } from "@priemskiyyy/flare-devtools";
import { FlareDevtools as FlareDevtoolsView } from "@priemskiyyy/flare-devtools/react";
import { FlareErrorBoundary, FlareProvider, useDestinationStatus, useFlare, useFlareStatus } from "@priemskiyyy/flare-react";
import type { RegisteredDestinationName } from "@priemskiyyy/flare-react";

type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;
const expectType = <TCheck extends true>(check: TCheck) => check;

declare const schemaOf: <TValue>() => StandardSchema<TValue>;
declare const sentrySdk: Parameters<typeof sentry>[0]["sdk"];
declare const bugsnagSdk: Parameters<typeof bugsnag>[0]["sdk"];
declare const bugsnagBreadcrumb: Parameters<typeof bugsnag>[0]["Breadcrumb"];
declare const crashlyticsSdk: Parameters<typeof crashlytics>[0]["sdk"];
declare const posthogSdk: Parameters<typeof posthog>[0]["sdk"];
declare const posthogClient: Parameters<typeof posthogReactNative>[0]["sdk"];
declare const datadogSdk: Parameters<typeof datadog>[0]["sdk"];
declare const ddRum: Parameters<typeof datadogReactNative>[0]["sdk"];
declare const browserLogs: Parameters<typeof datadogLogs>[0]["sdk"];
declare const otelLogger: Parameters<typeof opentelemetry>[0]["logger"];

const schema = {
  tags: { area: schemaOf<"upload" | "editor">() },
  contexts: { upload: schemaOf<{ attempt: number }>() },
  breadcrumbs: { uploadStarted: schemaOf<{ kind: "avatar" }>() },
} satisfies FlareSchema;

declare const attemptSchema: StandardSchema<string, number>;
const readonlyRoute = ["mock"] as const;
const transformed = new Flare({
  destinations: { mock: createMockAdapter().adapter },
  defaults: { to: readonlyRoute },
  schema: { tags: { attempt: attemptSchema } },
});
transformed.tag("attempt", "2");
transformed.message("typed input", { to: readonlyRoute });
// @ts-expect-error -- callers supply schema input, not transformed output.
transformed.tag("attempt", 2);

export const flare = new Flare({
  destinations: {
    console: console(),
    backend: http({
      // A client that resolves with nothing: the receipt then has no event id.
      request: async ({ report, signal }) => {
        await fetch("/api/error-reports", { method: "POST", body: JSON.stringify(report), signal });
      },
    }),
    sentry: sentry({ sdk: sentrySdk }),
    bugsnag: bugsnag({ sdk: bugsnagSdk, Breadcrumb: bugsnagBreadcrumb, messages: "as-error" }),
    crashlytics: crashlytics({ sdk: crashlyticsSdk, ambient: { user: true } }),
    mock: createMockAdapter().adapter,
  },
  defaults: { to: ["sentry", "backend"] },
  schema,
  privacy: { redact: (key) => isSensitiveKey(key) || key === "ssn", scrub: (text) => text },
});

// Adapters over provider SDKs a consumer installs separately.
export const providers = new Flare({
  destinations: {
    posthog: posthog({ sdk: posthogSdk }),
    posthogMobile: posthogReactNative({ sdk: posthogClient }),
    datadog: datadog({ sdk: datadogSdk }),
    datadogMobile: datadogReactNative({ sdk: ddRum }),
    datadogLogs: datadogLogs({ sdk: browserLogs }),
    otel: opentelemetry({ logger: otelLogger, forceFlush: async () => {} }),
  },
});
export const posthogHandle: typeof posthogSdk | null = providers.destination("posthog").native;
export const ddRumHandle: typeof ddRum | null = providers.destination("datadogMobile").native;

// The registered path: one augmentation types every hook and the boundary.
declare module "@priemskiyyy/flare-react" {
  interface Register {
    flare: typeof flare;
  }
}

expectType<Equal<RegisteredDestinationName, "console" | "backend" | "sentry" | "bugsnag" | "crashlytics" | "mock">>(true);

const receipt: Receipt<RegisteredDestinationName> = flare.capture(new Error("typed"), { to: ["backend"], tags: { area: "upload" } });
export const settled = receipt.settled.then((status) => (status.state === "settled" ? status.outcomes.backend?.status : null));
export const mockSession: MockSession | null = flare.destination("mock").native;

// @ts-expect-error -- "newrelic" is not a registered destination.
flare.capture(new Error("typed"), { to: ["newrelic"] });
// @ts-expect-error -- "billing" is not a declared area.
flare.tag("area", "billing");
// @ts-expect-error -- "clicked" is not a declared breadcrumb.
flare.breadcrumb("clicked");
// @ts-expect-error -- a declared breadcrumb requires its data.
flare.breadcrumb("uploadStarted");

export const View = () => {
  const registered = useFlare();
  const status = useFlareStatus();
  const backend = useDestinationStatus("backend");
  registered.tag("area", "editor");
  // @ts-expect-error -- "newrelic" is not a registered destination.
  useDestinationStatus("newrelic");
  // @ts-expect-error -- "billing" is not a declared area.
  registered.tag("area", "billing");
  return <span>{status.state + backend.state}</span>;
};

export const Root = () => (
  <FlareProvider flare={flare}>
    <FlareErrorBoundary fallback={({ reset }) => <button type="button" onClick={reset}>Retry</button>} capture={{ tags: { area: "editor" }, to: ["sentry"] }}>
      <View />
    </FlareErrorBoundary>
    <FlareDevtoolsView initialIsOpen maxEvents={100} />
  </FlareProvider>
);

// @ts-expect-error -- a boundary's capture options are typed by the registered schema.
export const badBoundary = <FlareErrorBoundary fallback={null} capture={{ tags: { area: "billing" } }} />;

export const inspector = new FlareDevtools({ flare });

declare const source: TraceEventSource<{ "checkout.started": { cartId: string } }>;
export const stop: () => void = traceBreadcrumbs({
  source,
  flare,
  map: { "checkout.started": ({ cartId }) => ({ name: "uploadStarted", data: { cartId } }) },
});

// A third party can write an adapter from the published types alone.
export const custom: ReporterAdapter<{ sent: SanitizedReport[] }> = {
  name: "custom",
  open: () => {
    const sent: SanitizedReport[] = [];
    return {
      native: { sent },
      submit: (report) => {
        sent.push(report);
        if (report.kind === "exception") {
          new SanitizedError(report.exception);
        }
        return { status: "submitted", evidence: "sdk-call-returned" };
      },
    };
  },
};
`,
  );

  write(
    "smoke.mjs",
    `import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import * as core from "@priemskiyyy/flare";
import * as mock from "@priemskiyyy/flare/mock";
import * as consoleAdapter from "@priemskiyyy/flare-console";
import * as http from "@priemskiyyy/flare-http";
import * as sentry from "@priemskiyyy/flare-sentry";
import * as bugsnag from "@priemskiyyy/flare-bugsnag";
import * as crashlytics from "@priemskiyyy/flare-crashlytics";
import * as posthog from "@priemskiyyy/flare-posthog";
import * as posthogReactNative from "@priemskiyyy/flare-posthog-react-native";
import * as datadog from "@priemskiyyy/flare-datadog";
import * as datadogReactNative from "@priemskiyyy/flare-datadog-react-native";
import * as datadogLogs from "@priemskiyyy/flare-datadog-logs";
import * as opentelemetry from "@priemskiyyy/flare-opentelemetry";
import * as trace from "@priemskiyyy/flare-trace";
import * as devtools from "@priemskiyyy/flare-devtools";
import * as react from "@priemskiyyy/flare-react";
import * as vue from "@priemskiyyy/flare-vue";
import * as solid from "@priemskiyyy/flare-solid";
import * as devtoolsVue from "@priemskiyyy/flare-devtools/vue";
import * as devtoolsSolid from "@priemskiyyy/flare-devtools/solid";
import { createSSRApp, h } from "vue";
import { renderToString as renderVueToString } from "vue/server-renderer";

// The Svelte packages ship sources for the application's compiler, so plain
// Node cannot import them. Their types are checked above instead.

// Named exports only, and exactly the ones each package promises.
const surfaces = [
  [core, ["Flare", "FlareError", "SanitizedError", "isSensitiveKey"]],
  [mock, ["createMockAdapter"]],
  [consoleAdapter, ["console"]],
  [http, ["http"]],
  [sentry, ["sentry"]],
  [bugsnag, ["bugsnag"]],
  [crashlytics, ["crashlytics"]],
  [posthog, ["posthog"]],
  [posthogReactNative, ["posthog"]],
  [datadog, ["datadog"]],
  [datadogReactNative, ["datadog"]],
  [datadogLogs, ["datadogLogs"]],
  [opentelemetry, ["opentelemetry"]],
  [trace, ["traceBreadcrumbs"]],
  [devtools, ["FlareDevtools"]],
  [react, ["FlareErrorBoundary", "FlareProvider", "useDestinationStatus", "useFlare", "useFlareStatus"]],
  [vue, ["FlareErrorBoundary", "FlareProvider", "useDestinationStatus", "useFlare", "useFlareStatus"]],
  [solid, ["FlareErrorBoundary", "FlareProvider", "useDestinationStatus", "useFlare", "useFlareStatus"]],
  [devtoolsVue, ["FlareDevtools"]],
  [devtoolsSolid, ["FlareDevtools"]],
];
for (const [module, names] of surfaces) {
  assert.deepEqual(Object.keys(module).sort(), names);
  assert.equal("default" in module, false);
}

const lines = [];
const requests = [];
const flare = new core.Flare({
  destinations: {
    console: consoleAdapter.console({ writer: ({ line }) => lines.push(line) }),
    backend: http.http({
      request: async ({ report, signal }) => {
        requests.push({ report, signal });
        return { id: "evt_1" };
      },
    }),
  },
  privacy: { scrub: (text) => text.replaceAll("sk_live_12345", "[key]") },
});

// Rendering on a server is inert and needs no started Flare.
const html = renderToString(
  createElement(react.FlareProvider, { flare }, createElement(react.FlareErrorBoundary, { fallback: null }, "ready")),
);
assert.equal(html, "ready");
assert.deepEqual(requests, []);

const vueHtml = await renderVueToString(
  createSSRApp(() => h(vue.FlareProvider, { flare }, () => h(devtoolsVue.FlareDevtools))),
);
// Vue wraps a slot in fragment markers. Apart from those, only the empty host is rendered.
assert.equal(vueHtml.replaceAll("<!--[-->", "").replaceAll("<!--]-->", ""), "<div data-flare-devtools></div>");
assert.deepEqual(requests, []);

const early = flare.capture(new Error("captured before start, with sk_live_12345"));
flare.start();
flare.user({ id: "user_42" });
const status = await early.settled;

assert.equal(status.state, "settled");
assert.deepEqual(status.outcomes.console, { status: "submitted", evidence: "sdk-call-returned", event: null, losses: [] });
assert.deepEqual(status.outcomes.backend, { status: "submitted", evidence: "backend-acknowledged", event: { id: "evt_1" }, losses: [] });
assert.equal(lines[0], "[flare] error Error: captured before start, with [key]");
assert.equal(requests[0].report.id, early.id);
assert.equal(JSON.stringify(requests).includes("sk_live_12345"), false);

flare.dispose();
assert.deepEqual((await flare.capture(new Error("late")).settled), { state: "dropped", reason: "disposed" });

// An adapter over an injected SDK, through its packed bundle.
const captured = [];
const posthogFlare = new core.Flare({
  destinations: {
    posthog: posthog.posthog({
      sdk: {
        __loaded: true,
        exceptions: {},
        get_distinct_id: () => "user_42",
        captureException: (error, properties) => {
          captured.push({ error, properties });
          return { uuid: "uuid_1" };
        },
      },
    }),
  },
});
posthogFlare.start();
posthogFlare.user({ id: "user_42" });
const exception = posthogFlare.capture(new Error("upload failed"), { tags: { area: "upload" } });
assert.deepEqual((await exception.settled).outcomes.posthog, { status: "submitted", evidence: "sdk-call-returned", event: { id: "uuid_1" }, losses: [] });
assert.equal(captured[0].error.message, "upload failed");
// One core, so the adapter's error is the class the application imports.
assert.ok(captured[0].error instanceof core.SanitizedError);
assert.equal(captured[0].properties.area, "upload");
assert.equal(captured[0].properties["flare.report_id"], exception.id);
posthogFlare.dispose();

const addedErrors = [];
const datadogFlare = new core.Flare({
  destinations: {
    datadog: datadog.datadog({
      sdk: {
        getInitConfiguration: () => ({ applicationId: "app" }),
        getUser: () => ({}),
        addError: (error, context) => addedErrors.push({ error, context }),
      },
    }),
  },
});
datadogFlare.start();
const failure = datadogFlare.capture(new Error("upload failed"), { tags: { area: "upload" } });
assert.equal((await failure.settled).outcomes.datadog.status, "submitted");
assert.equal(addedErrors[0].error.message, "upload failed");
assert.equal(addedErrors[0].context.flare.tags.area, "upload");
assert.equal(addedErrors[0].context.flare.report_id, failure.id);
datadogFlare.dispose();

const recorded = [];
const mobileFlare = new core.Flare({
  destinations: {
    datadog: datadogReactNative.datadog({
      sdk: { addError: async (message, source, stacktrace, context, timestamp) => recorded.push({ message, source, context, timestamp }) },
    }),
    posthog: posthogReactNative.posthog({
      sdk: {
        ready: async () => {},
        getDistinctId: () => "anonymous",
        captureException: (error, properties) => recorded.push({ error, properties }),
        flush: async () => {},
      },
    }),
  },
});
mobileFlare.start();
const mobile = mobileFlare.capture(new Error("sync failed"));
const mobileStatus = await mobile.settled;
assert.equal(mobileStatus.outcomes.datadog.status, "submitted");
assert.equal(mobileStatus.outcomes.posthog.status, "submitted");
assert.equal(recorded[0].message, "sync failed");
assert.equal(recorded[0].context.flare.report_id, mobile.id);
assert.equal(recorded[1].properties["flare.report_id"], mobile.id);
mobileFlare.dispose();

const logged = [];
const emitted = [];
const logsFlare = new core.Flare({
  destinations: {
    logs: datadogLogs.datadogLogs({
      sdk: {
        getInitConfiguration: () => ({ clientToken: "pub" }),
        getUser: () => ({}),
        logger: { log: (message, context, status, error) => logged.push({ message, context, status, error }) },
      },
    }),
    otel: opentelemetry.opentelemetry({ logger: { emit: (record) => emitted.push(record) } }),
  },
});
logsFlare.start();
const note = logsFlare.message("checkout retried", { level: "warning" });
const noteStatus = await note.settled;
assert.equal(noteStatus.outcomes.logs.status, "submitted");
assert.equal(noteStatus.outcomes.otel.status, "submitted");
assert.deepEqual([logged[0].message, logged[0].status, logged[0].error], ["checkout retried", "warn", undefined]);
assert.equal(logged[0].context.flare.report_id, note.id);
assert.deepEqual([emitted[0].body, emitted[0].severityNumber], ["checkout retried", 13]);
assert.equal(emitted[0].attributes["flare.report_id"], note.id);
logsFlare.dispose();
console.log("The packed packages work end to end.");
`,
  );

  write(
    "contracts.frameworks.ts",
    `import { createComponent } from "solid-js";
import { h } from "vue";
import { FlareDevtools as SolidDevtools } from "@priemskiyyy/flare-devtools/solid";
import { createDevtools } from "@priemskiyyy/flare-devtools/svelte";
import { FlareDevtools as VueDevtools } from "@priemskiyyy/flare-devtools/vue";
import * as solid from "@priemskiyyy/flare-solid";
import type { RegisteredDestinationName as SolidName } from "@priemskiyyy/flare-solid";
import * as svelte from "@priemskiyyy/flare-svelte";
import type { RegisteredDestinationName as SvelteName } from "@priemskiyyy/flare-svelte";
import * as vue from "@priemskiyyy/flare-vue";
import type { RegisteredDestinationName as VueName } from "@priemskiyyy/flare-vue";
import type { flare } from "./contracts";

type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;
const expectType = <TCheck extends true>(check: TCheck) => check;
type Names = "console" | "backend" | "sentry" | "bugsnag" | "crashlytics" | "mock";

// The registered path, once per binding.
declare module "@priemskiyyy/flare-vue" {
  interface Register {
    flare: typeof flare;
  }
}
declare module "@priemskiyyy/flare-solid" {
  interface Register {
    flare: typeof flare;
  }
}
declare module "@priemskiyyy/flare-svelte" {
  interface Register {
    flare: typeof flare;
  }
}

expectType<Equal<VueName, Names>>(true);
expectType<Equal<SolidName, Names>>(true);
expectType<Equal<SvelteName, Names>>(true);

export const useVue = () => {
  vue.useFlare().value.tag("area", "editor");
  const state: string = vue.useDestinationStatus("backend").value.state;
  // @ts-expect-error -- "newrelic" is not a registered destination.
  vue.useDestinationStatus("newrelic");
  // @ts-expect-error -- "billing" is not a declared area.
  vue.useFlare().value.tag("area", "billing");
  return [state, vue.useFlareStatus().value.state, h(VueDevtools, { maxEvents: 100 })];
};

export const useSolid = () => {
  solid.useFlare()().tag("area", "editor");
  const state: string = solid.useDestinationStatus("backend")().state;
  // @ts-expect-error -- "newrelic" is not a registered destination.
  solid.useDestinationStatus("newrelic");
  return [state, solid.useFlareStatus()().state, createComponent(SolidDevtools, { initialIsOpen: true })];
};

export const useSvelte = () => {
  svelte.useFlare().current.tag("area", "editor");
  const state: string = svelte.useDestinationStatus("backend").current.state;
  // @ts-expect-error -- "newrelic" is not a registered destination.
  svelte.useDestinationStatus("newrelic");
  return [state, svelte.useFlareStatus().current.state, createDevtools({ maxEvents: 100 })];
};

export const boundaryProps: svelte.FlareErrorBoundaryProps = { capture: { tags: { area: "upload" }, to: ["sentry"] } };
// @ts-expect-error -- a boundary's capture options are typed by the registered schema.
export const badBoundaryProps: vue.FlareErrorBoundaryProps = { capture: { tags: { area: "billing" } } };
`,
  );

  process.stdout.write("Typechecking the public contracts...\n");
  run("npx", ["tsc", "--noEmit", "-p", "."]);
  process.stdout.write("Running the packed packages under Node...\n");
  process.stdout.write(run("node", ["smoke.mjs"]));
  process.stdout.write(
    `Verified ${tarballs.length} packages. Release artifacts are in .artifacts/release.\n`,
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
