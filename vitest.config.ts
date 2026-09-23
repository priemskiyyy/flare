import { svelte } from "@sveltejs/vite-plugin-svelte";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import type { TestProjectConfiguration } from "vitest/config";

type ProjectOptions = {
  environment: "node" | "jsdom";
  dedupe: string[];
};

const project = (
  directory: string,
  name: string,
  options: Partial<ProjectOptions> = {},
) =>
  ({
    extends: true,
    resolve: {
      alias: {
        src: fileURLToPath(
          new URL(`./${directory}/${name}/src`, import.meta.url),
        ),
      },
      dedupe: options.dedupe ?? [],
    },
    test: {
      name,
      include: [`${directory}/${name}/src/**/*.test.{ts,tsx}`],
      environment: options.environment ?? "node",
    },
  }) satisfies TestProjectConfiguration;

// The devtools core is Solid: it needs the Solid plugin and browser
// resolution so effects run in jsdom. The wrappers import the inspector by its
// package name, which resolves to the source here, and the React wrapper's
// test renders against the same React instance as the binding.
const devtoolsProject: TestProjectConfiguration = {
  extends: true,
  // Its wrappers are tested against every binding, so the Svelte plugin joins in.
  plugins: [solid(), svelte({ configFile: false })],
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./packages/devtools/src", import.meta.url)),
      "@priemskiyyy/flare-devtools": fileURLToPath(
        new URL("./packages/devtools/src/index.ts", import.meta.url),
      ),
    },
    conditions: ["development", "browser"],
    dedupe: ["react", "react-dom", "vue"],
  },
  test: {
    name: "devtools",
    include: ["packages/devtools/src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    server: { deps: { inline: [/solid-js/, /@solidjs\/testing-library/] } },
  },
};

// The example is tested like an application: through its buttons, over the
// built packages it imports by name.
const exampleProject: TestProjectConfiguration = {
  extends: true,
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./examples/react/src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    name: "example-react",
    include: ["examples/react/src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    // Node would load the icons with their own React; through Vite they share
    // the deduplicated one, as CI's React version swap needs.
    server: { deps: { inline: ["@phosphor-icons/react"] } },
  },
};

// Every adapter is an ordinary node project named after its folder, so a new
// one is tested without being listed here.
const adapterProjects = readdirSync(
  new URL("./packages/adapters", import.meta.url),
)
  .filter((name) =>
    existsSync(
      new URL(`./packages/adapters/${name}/package.json`, import.meta.url),
    ),
  )
  .map((name) => project("packages/adapters", name));

export default defineConfig({
  test: {
    globals: false,
    restoreMocks: true,
    projects: [
      project("packages", "core"),
      project("packages", "react", {
        environment: "jsdom",
        // A binding must render against the same React instance as the renderer under test.
        dedupe: ["react", "react-dom"],
      }),
      {
        ...project("packages", "vue", {
          environment: "jsdom",
          dedupe: ["vue"],
        }),
        test: {
          name: "vue",
          environment: "jsdom",
          include: ["packages/vue/src/**/*.test.ts"],
          exclude: ["**/*.server.test.ts"],
        },
      },
      {
        ...project("packages", "vue", { dedupe: ["vue"] }),
        test: {
          name: "vue-ssr",
          include: ["packages/vue/src/**/*.server.test.ts"],
          environment: "node",
        },
      },
      {
        ...project("packages", "solid"),
        plugins: [solid()],
        resolve: {
          alias: {
            src: fileURLToPath(
              new URL("./packages/solid/src", import.meta.url),
            ),
          },
          conditions: ["development", "browser"],
          dedupe: ["solid-js"],
        },
        test: {
          name: "solid",
          environment: "jsdom",
          include: ["packages/solid/src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.server.test.tsx"],
          server: {
            deps: { inline: [/solid-js/, /@solidjs\/testing-library/] },
          },
        },
      },
      {
        ...project("packages", "solid"),
        plugins: [solid({ ssr: true })],
        test: {
          name: "solid-ssr",
          environment: "node",
          include: ["packages/solid/src/**/*.server.test.tsx"],
        },
      },
      {
        ...project("packages", "svelte"),
        plugins: [svelte({ configFile: false })],
        resolve: { conditions: ["browser"] },
        test: {
          name: "svelte",
          environment: "jsdom",
          include: ["packages/svelte/src/**/*.test.ts"],
          exclude: ["**/*.server.test.ts"],
        },
      },
      {
        ...project("packages", "svelte"),
        plugins: [svelte({ configFile: false })],
        test: {
          name: "svelte-ssr",
          environment: "node",
          include: ["packages/svelte/src/**/*.server.test.ts"],
        },
      },
      devtoolsProject,
      project("packages", "trace"),
      ...adapterProjects,
      exampleProject,
    ],
  },
});
