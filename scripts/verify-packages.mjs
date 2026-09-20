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

// Every published entry: whether it is a client module, and which provider SDK
// it must never import. An adapter is handed its SDK by the application.
const bundles = [
  { file: "@priemskiyyy/flare/dist/index.js" },
  { file: "@priemskiyyy/flare/dist/mock.js" },
  { file: "@priemskiyyy/flare/dist/testing.js" },
  { file: "@priemskiyyy/flare-react/dist/index.js", client: true },
  { file: "@priemskiyyy/flare-vue/dist/index.js" },
  { file: "@priemskiyyy/flare-solid/dist/index.js" },
  // Svelte ships its sources unbundled, for the application's own compiler.
  { file: "@priemskiyyy/flare-svelte/dist/index.js" },
  { file: "@priemskiyyy/flare-devtools/dist/index.js" },
  { file: "@priemskiyyy/flare-devtools/dist/react.js", client: true },
  { file: "@priemskiyyy/flare-devtools/dist/vue.js" },
  { file: "@priemskiyyy/flare-devtools/dist/solid.js" },
  { file: "@priemskiyyy/flare-devtools/dist/svelte.js" },
  { file: "@priemskiyyy/flare-trace/dist/index.js" },
  { file: "@priemskiyyy/flare-console/dist/index.js" },
  { file: "@priemskiyyy/flare-http/dist/index.js" },
  { file: "@priemskiyyy/flare-sentry/dist/index.js", sdk: "@sentry/" },
  { file: "@priemskiyyy/flare-sentry/dist/reactNative.js", sdk: "@sentry/" },
  { file: "@priemskiyyy/flare-bugsnag/dist/index.js", sdk: "@bugsnag/" },
  { file: "@priemskiyyy/flare-bugsnag/dist/reactNative.js", sdk: "@bugsnag/" },
  {
    file: "@priemskiyyy/flare-crashlytics/dist/index.js",
    sdk: "@react-native-firebase/",
  },
];

// A real import or re-export, not the word in a JSDoc example.
const importsFrom = (bundle, prefix) =>
  new RegExp(
    `^\\s*(?:import|export)[^\\n]*from\\s+"${prefix}|import\\("${prefix}|require\\("${prefix}`,
    "m",
  ).test(bundle);

try {
  rmSync(release, { recursive: true, force: true });
  mkdirSync(artifacts, { recursive: true });
  const tarballs = ["packages", "packages/adapters"].flatMap((group) =>
    readdirSync(path.join(workspace, group))
      .filter((directory) =>
        existsSync(path.join(workspace, group, directory, "package.json")),
      )
      .map((directory) => {
        const packageDirectory = path.join(workspace, group, directory);
        process.stdout.write(
          run("pnpm", ["exec", "publint", packageDirectory], workspace),
        );
        const [packed] = JSON.parse(
          run(
            "npm",
            [
              "pack",
              "--ignore-scripts",
              "--json",
              "--pack-destination",
              artifacts,
            ],
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
        const manifest = JSON.parse(
          readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
        );
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
      }),
  );

  json("package.json", {
    name: "flare-package-consumer",
    private: true,
    type: "module",
    dependencies: Object.fromEntries(
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

  for (const { file, client = false, sdk } of bundles) {
    const bundle = read(file);
    assert(!bundle.includes('from "src/'), `${file} kept a src alias import.`);
    assert.equal(
      bundle.startsWith('"use client";'),
      client,
      `${file} has the wrong "use client" state.`,
    );
    // Default exports break silently under some React Native interop.
    assert(!/^export default /m.test(bundle), `${file} has a default export.`);
    if (sdk !== undefined) {
      assert(!importsFrom(bundle, sdk), `${file} imports a provider SDK.`);
    }
  }

  // Exactly one copy of the core, and one of the inspector, however many
  // packages build on them.
  for (const dependent of [
    "flare-react",
    "flare-vue",
    "flare-solid",
    "flare-svelte",
    "flare-devtools",
    "flare-trace",
    "flare-console",
    "flare-http",
    "flare-sentry",
    "flare-bugsnag",
    "flare-crashlytics",
  ]) {
    assert(
      !existsSync(
        path.join(
          consumer,
          "node_modules/@priemskiyyy",
          dependent,
          "node_modules/@priemskiyyy/flare",
        ),
      ),
      `${dependent} installed its own copy of the core.`,
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
    `import { createReporterAdapter, DEFAULT_REDACT, Flare, rebuildError } from "@priemskiyyy/flare";
import type { FlareSchema, Receipt, ReporterAdapter, SanitizedReport, StandardSchema } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import type { MockSession } from "@priemskiyyy/flare/mock";
import { consoleReporter } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";
import { sentry } from "@priemskiyyy/flare-sentry";
import { sentry as sentryReactNative } from "@priemskiyyy/flare-sentry/react-native";
import { bugsnag } from "@priemskiyyy/flare-bugsnag";
import { bugsnag as bugsnagReactNative } from "@priemskiyyy/flare-bugsnag/react-native";
import { crashlytics } from "@priemskiyyy/flare-crashlytics";
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
declare const crashlyticsSdk: Parameters<typeof crashlytics>[0]["sdk"];

const schema = {
  tags: { area: schemaOf<"upload" | "editor">() },
  contexts: { upload: schemaOf<{ attempt: number }>() },
  breadcrumbs: { uploadStarted: schemaOf<{ kind: "avatar" }>() },
} satisfies FlareSchema;

declare const attemptSchema: StandardSchema<string, number>;
const readonlyRoute = ["mock"] as const;
const transformed = new Flare({
  destinations: { mock: createMockAdapter().adapter },
  default: readonlyRoute,
  schema: { tags: { attempt: attemptSchema } },
});
transformed.tag("attempt", "2");
transformed.message("typed input", { to: readonlyRoute });
// @ts-expect-error -- callers supply schema input, not transformed output.
transformed.tag("attempt", 2);

export const flare = new Flare({
  destinations: {
    console: consoleReporter(),
    backend: http({ endpoint: "/api/error-reports", authorize: () => ({ authorization: "Bearer token" }) }),
    sentry: sentry({ sdk: sentrySdk }),
    bugsnag: bugsnag({ sdk: bugsnagSdk, messages: "as-error" }),
    crashlytics: crashlytics({ sdk: crashlyticsSdk, ambient: { user: true } }),
    mock: createMockAdapter().adapter,
  },
  default: ["sentry", "backend"],
  schema,
  privacy: { redact: [...DEFAULT_REDACT, "ssn"], scrub: (text) => text },
});

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

// @ts-expect-error -- "datadog" is not a registered destination.
flare.capture(new Error("typed"), { to: ["datadog"] });
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
  // @ts-expect-error -- "datadog" is not a registered destination.
  useDestinationStatus("datadog");
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
export const custom: ReporterAdapter<{ sent: SanitizedReport[] }> = createReporterAdapter({
  name: "custom",
  capabilities: consoleReporter().capabilities,
  open: () => {
    const sent: SanitizedReport[] = [];
    return {
      native: { sent },
      submit: (report) => {
        sent.push(report);
        if (report.kind === "exception") {
          rebuildError(report.exception);
        }
        return { status: "submitted", evidence: "sdk-call-returned" };
      },
    };
  },
});

export const reactNativeAdapters = [sentryReactNative({ sdk: sentrySdk }), bugsnagReactNative({ sdk: bugsnagSdk })];
`,
  );

  write(
    "smoke.mjs",
    `import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import * as core from "@priemskiyyy/flare";
import * as mock from "@priemskiyyy/flare/mock";
import * as consoleReporter from "@priemskiyyy/flare-console";
import * as http from "@priemskiyyy/flare-http";
import * as sentry from "@priemskiyyy/flare-sentry";
import * as sentryReactNative from "@priemskiyyy/flare-sentry/react-native";
import * as bugsnag from "@priemskiyyy/flare-bugsnag";
import * as bugsnagReactNative from "@priemskiyyy/flare-bugsnag/react-native";
import * as crashlytics from "@priemskiyyy/flare-crashlytics";
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
  [core, ["DEFAULT_REDACT", "Flare", "createReporterAdapter", "rebuildError"]],
  [mock, ["createMockAdapter"]],
  [consoleReporter, ["consoleReporter"]],
  [http, ["http"]],
  [sentry, ["sentry"]],
  [sentryReactNative, ["sentry"]],
  [bugsnag, ["bugsnag"]],
  [bugsnagReactNative, ["bugsnag"]],
  [crashlytics, ["crashlytics"]],
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
    console: consoleReporter.consoleReporter({ writer: ({ line }) => lines.push(line) }),
    backend: http.http({
      endpoint: "https://api.example.test/error-reports",
      fetch: async (url, init) => {
        requests.push({ url, init });
        return Response.json({ id: "evt_1" }, { status: 202 });
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
assert.equal(requests[0].init.headers["idempotency-key"], early.id);
assert.equal(JSON.stringify(requests).includes("sk_live_12345"), false);

flare.dispose();
assert.deepEqual((await flare.capture(new Error("late")).settled), { state: "dropped", reason: "disposed" });
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
  // @ts-expect-error -- "datadog" is not a registered destination.
  vue.useDestinationStatus("datadog");
  // @ts-expect-error -- "billing" is not a declared area.
  vue.useFlare().value.tag("area", "billing");
  return [state, vue.useFlareStatus().value.state, h(VueDevtools, { maxEvents: 100 })];
};

export const useSolid = () => {
  solid.useFlare()().tag("area", "editor");
  const state: string = solid.useDestinationStatus("backend")().state;
  // @ts-expect-error -- "datadog" is not a registered destination.
  solid.useDestinationStatus("datadog");
  return [state, solid.useFlareStatus()().state, createComponent(SolidDevtools, { initialIsOpen: true })];
};

export const useSvelte = () => {
  svelte.useFlare().current.tag("area", "editor");
  const state: string = svelte.useDestinationStatus("backend").current.state;
  // @ts-expect-error -- "datadog" is not a registered destination.
  svelte.useDestinationStatus("datadog");
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
