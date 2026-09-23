import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig } from "vitepress";

const siteUrl = process.env.DOCS_SITE_URL;

const repositoryUrl =
  process.env.DOCS_REPOSITORY_URL ?? "https://github.com/priemskiyyy/flare";

const base =
  process.env.DOCS_BASE_PATH ?? (siteUrl ? new URL(siteUrl).pathname : "/");

const description =
  "Provider-independent error reporting for TypeScript. One API over Sentry, Bugsnag, Crashlytics, your own backend and the console, with account boundaries, redaction, typed routing and honest receipts.";

// llms.txt lists every guide with its description; llms-full.txt inlines them.
const writeLlmsText = async (srcDir: string, outDir: string) => {
  const origin = siteUrl ? siteUrl.replace(/\/$/, "") : base.replace(/\/$/, "");

  const files = (await readdir(srcDir, { recursive: true }))
    .filter((file) => file.endsWith(".md"))
    .filter((file) => !file.startsWith(".vitepress"))
    .filter((file) => file !== "README.md" && file !== "index.md")
    .sort();

  const pages = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(srcDir, file), "utf8");
      const title = source.match(/^# (.+)$/m)?.[1] ?? file;
      const summary = source.match(/^description: "(.+)"$/m)?.[1] ?? "";
      const url = `${origin}/${file.replace(/\.md$/, "")}`;

      return { title, summary, url, source };
    }),
  );

  const index = [
    "# Flare",
    "",
    `> ${description}`,
    "",
    "## Docs",
    "",
    ...pages.map(
      ({ title, summary, url }) => `- [${title}](${url}): ${summary}`,
    ),
    "",
  ].join("\n");

  const full = pages
    .map(({ url, source }) => `<!-- ${url} -->\n${source.trim()}`)
    .join("\n\n---\n\n");

  await writeFile(join(outDir, "llms.txt"), index);
  await writeFile(join(outDir, "llms-full.txt"), `${full}\n`);
};

export default defineConfig({
  base,
  lang: "en-US",
  title: "Flare",
  description,
  head: [
    [
      "link",
      { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` },
    ],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Flare" }],
    ["meta", { name: "twitter:card", content: "summary" }],
    ["meta", { name: "theme-color", content: "#b45309" }],
  ],
  ...(siteUrl ? { sitemap: { hostname: siteUrl } } : {}),
  buildEnd: async ({ outDir, srcDir }) => {
    const sitemap = siteUrl
      ? `Sitemap: ${new URL("sitemap.xml", `${siteUrl.replace(/\/$/, "")}/`).href}\n`
      : "";

    await writeFile(
      join(outDir, "robots.txt"),
      `User-agent: *\nAllow: /\n${sitemap}`,
    );
    await writeLlmsText(srcDir, outDir);
  },
  transformHead: ({ pageData }) => {
    const title =
      pageData.title === "Flare" ? "Flare" : `${pageData.title} | Flare`;

    const head: [string, Record<string, string>][] = [
      ["meta", { property: "og:title", content: title }],
      [
        "meta",
        {
          property: "og:description",
          content: pageData.description || description,
        },
      ],
      ["meta", { name: "twitter:title", content: title }],
      [
        "meta",
        {
          name: "twitter:description",
          content: pageData.description || description,
        },
      ],
    ];

    // Without a site URL the build omits canonical URLs rather than assume a host.
    if (!siteUrl) {
      return head;
    }

    const pagePath = pageData.relativePath
      .replace(/(^|\/)index\.md$/, "$1")
      .replace(/\.md$/, "");

    const url = new URL(pagePath, `${siteUrl.replace(/\/$/, "")}/`).href;

    head.push(
      ["link", { rel: "canonical", href: url }],
      ["meta", { property: "og:url", content: url }],
    );

    return head;
  },
  srcExclude: ["README.md"],
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    socialLinks: repositoryUrl ? [{ icon: "github", link: repositoryUrl }] : [],
    ...(repositoryUrl
      ? {
          editLink: { pattern: `${repositoryUrl}/edit/main/docs/:path` },
        }
      : {}),
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Adapters", link: "/adapters" },
      {
        text: "Frameworks",
        items: [
          { text: "React", link: "/react" },
          { text: "Vue", link: "/vue" },
          { text: "Solid", link: "/solid" },
          { text: "Svelte", link: "/svelte" },
          { text: "React Native and Expo", link: "/react-native" },
        ],
      },
      { text: "Devtools", link: "/devtools" },
      {
        text: "Reference",
        items: [
          { text: "Writing an adapter", link: "/writing-an-adapter" },
          { text: "Verification matrix", link: "/verification" },
          { text: "Runtime architecture", link: "/internals/architecture" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "What Flare is", link: "/" },
          { text: "Getting started", link: "/getting-started" },
          { text: "Installation", link: "/installation" },
          { text: "The mental model", link: "/mental-model" },
        ],
      },
      {
        text: "Reporting",
        items: [
          { text: "Capture and message", link: "/capture-and-message" },
          { text: "Tags, contexts, breadcrumbs", link: "/metadata" },
          { text: "Users and account switching", link: "/identity" },
          { text: "Scopes and concurrency", link: "/scopes" },
          { text: "Routing and defaults", link: "/routing" },
          { text: "Privacy and redaction", link: "/privacy" },
        ],
      },
      {
        text: "Delivery",
        items: [
          { text: "Receipts and evidence", link: "/receipts" },
          { text: "Flush", link: "/flush" },
          { text: "Automatic and manual capture", link: "/automatic-capture" },
        ],
      },
      {
        text: "Destinations",
        items: [
          { text: "Choose an adapter", link: "/adapters" },
          { text: "Provider limitations", link: "/provider-limitations" },
          { text: "Native access", link: "/native-access" },
          { text: "An HTTP backend", link: "/http-backend" },
        ],
      },
      {
        text: "Frameworks",
        items: [
          { text: "React", link: "/react" },
          { text: "Vue", link: "/vue" },
          { text: "Solid", link: "/solid" },
          { text: "Svelte", link: "/svelte" },
          { text: "React Native and Expo", link: "/react-native" },
          { text: "Server rendering", link: "/server-rendering" },
          { text: "The Trace bridge", link: "/trace" },
        ],
      },
      {
        text: "Inspect and test",
        items: [
          { text: "Diagnostics and devtools", link: "/devtools" },
          { text: "Application testing", link: "/testing" },
          { text: "Verification matrix", link: "/verification" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Writing an adapter", link: "/writing-an-adapter" },
          { text: "Runtime architecture", link: "/internals/architecture" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3] },
    footer: { message: "Released under the MIT License." },
  },
});
