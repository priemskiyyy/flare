import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compiles every `ts` and `tsx` fence in the documentation against the built
// packages, so an example cannot drift from the API it shows. A fence that is
// deliberately not a whole statement is marked `<!-- snippet: fragment -->` on
// the line before it and is skipped.

const workspace = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(workspace, ".artifacts", "snippets");
const FRAGMENT = "<!-- snippet: fragment -->";

const entries = {
  "@priemskiyyy/flare": "packages/core/dist/index.d.ts",
  "@priemskiyyy/flare/mock": "packages/core/dist/mock.d.ts",
  "@priemskiyyy/flare/testing": "packages/core/dist/testing.d.ts",
  "@priemskiyyy/flare-react": "packages/react/dist/index.d.ts",
  "@priemskiyyy/flare-vue": "packages/vue/dist/index.d.ts",
  "@priemskiyyy/flare-solid": "packages/solid/dist/index.d.ts",
  "@priemskiyyy/flare-svelte": "packages/svelte/dist/index.d.ts",
  "@priemskiyyy/flare-devtools": "packages/devtools/dist/index.d.ts",
  "@priemskiyyy/flare-devtools/react": "packages/devtools/dist/react.d.ts",
  "@priemskiyyy/flare-devtools/vue": "packages/devtools/dist/vue.d.ts",
  "@priemskiyyy/flare-devtools/solid": "packages/devtools/dist/solid.d.ts",
  "@priemskiyyy/flare-devtools/svelte": "packages/devtools/dist/svelte.d.ts",
  "@priemskiyyy/flare-trace": "packages/trace/dist/index.d.ts",
  "@priemskiyyy/flare-console": "packages/adapters/console/dist/index.d.ts",
  "@priemskiyyy/flare-http": "packages/adapters/http/dist/index.d.ts",
  "@priemskiyyy/flare-sentry": "packages/adapters/sentry/dist/index.d.ts",
  "@priemskiyyy/flare-sentry/react-native":
    "packages/adapters/sentry/dist/reactNative.d.ts",
  "@priemskiyyy/flare-bugsnag": "packages/adapters/bugsnag/dist/index.d.ts",
  "@priemskiyyy/flare-bugsnag/react-native":
    "packages/adapters/bugsnag/dist/reactNative.d.ts",
  "@priemskiyyy/flare-crashlytics":
    "packages/adapters/crashlytics/dist/index.d.ts",
};

const listMarkdown = (directory) =>
  readdirSync(path.join(workspace, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        const skipped = ["node_modules", "dist", ".vitepress", ".artifacts"];

        return skipped.includes(entry.name) ? [] : listMarkdown(relative);
      }

      return entry.name.endsWith(".md") ? [relative] : [];
    },
  );

const files = [
  "README.md",
  ...listMarkdown("docs"),
  ...listMarkdown("packages").filter((file) => file.endsWith("README.md")),
  ...(existsSync(path.join(workspace, "examples"))
    ? listMarkdown("examples")
    : []),
];

const snippets = [];
let fragments = 0;

for (const file of files) {
  const lines = readFileSync(path.join(workspace, file), "utf8").split("\n");
  let open = null;

  for (const [index, line] of lines.entries()) {
    if (open === null) {
      const fence = line.match(/^```(tsx?)\b/);

      if (fence === null) {
        continue;
      }

      const before = lines
        .slice(0, index)
        .findLast((text) => text.trim() !== "");

      open = {
        file,
        line: index + 1,
        extension: fence[1],
        fragment: before?.trim() === FRAGMENT,
        body: [],
      };
      continue;
    }

    if (line.startsWith("```")) {
      if (open.fragment) {
        fragments += 1;
      } else {
        snippets.push(open);
      }

      open = null;
      continue;
    }

    open.body.push(line);
  }
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const snippet of snippets) {
  const slug = snippet.file.replace(/[^a-zA-Z0-9]+/g, "_");
  const name = `${slug}__L${snippet.line}.${snippet.extension}`;

  writeFileSync(
    path.join(output, name),
    `// ${snippet.file}:${snippet.line}\n${snippet.body.join("\n")}\nexport {};\n`,
  );
}

// Names an example may use without declaring them: the application's own
// objects, and the provider SDKs, which are peers a reader installs.
for (const name of ["ambient", "modules"]) {
  writeFileSync(
    path.join(output, `${name}.d.ts`),
    readFileSync(
      path.join(workspace, "scripts", `snippets.${name}.d.ts`),
      "utf8",
    ),
  );
}

writeFileSync(
  path.join(output, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        skipLibCheck: true,
        noEmit: true,
        types: ["node", "vite/client"],
        baseUrl: workspace,
        paths: Object.fromEntries(
          Object.entries(entries).map(([name, file]) => [name, [file]]),
        ),
      },
      include: ["*.ts", "*.tsx"],
    },
    null,
    2,
  )}\n`,
);

const result = spawnSync(
  "pnpm",
  ["exec", "tsc", "-p", output, "--pretty", "false"],
  {
    cwd: workspace,
    encoding: "utf8",
  },
);

if (result.status !== 0) {
  // `docs_routing_md__L12.ts(3,7)` becomes `docs/routing.md:14`.
  const located = `${result.stdout}${result.stderr}`.replace(
    /^\.artifacts\/snippets\/(.+?)__L(\d+)\.tsx?\((\d+),\d+\)/gm,
    (match, slug, start, offset) => {
      const snippet = snippets.find(
        (candidate) =>
          candidate.file.replace(/[^a-zA-Z0-9]+/g, "_") === slug &&
          String(candidate.line) === start,
      );

      if (snippet === undefined) {
        return match;
      }

      return `${snippet.file}:${Number(start) + Number(offset) - 1}`;
    },
  );

  process.stderr.write(located);
  process.stderr.write(
    `\nSome of the ${snippets.length} snippets do not compile.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `${snippets.length} snippets compile across ${files.length} files. ${fragments} fragments skipped.\n`,
);
