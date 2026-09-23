import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const relative = (file) => path.relative(root, file);

const markdownFiles = (directory) =>
  existsSync(directory)
    ? readdirSync(directory, { recursive: true })
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => path.join(directory, entry))
    : [];

const readmesUnder = (group) =>
  existsSync(path.join(root, group))
    ? readdirSync(path.join(root, group))
        .map((directory) => path.join(root, group, directory, "README.md"))
        .filter(existsSync)
    : [];

const docsPages = markdownFiles(path.join(root, "docs")).filter(
  (file) =>
    !relative(file).startsWith("docs/.vitepress/") &&
    !relative(file).includes("node_modules"),
);

const sources = [
  ...docsPages,
  ...["packages", "packages/adapters", "examples"].flatMap(readmesUnder),
  ...[
    "README.md",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "RELEASING.md",
    "SUPPORT.md",
    "CHANGELOG.md",
  ].map((file) => path.join(root, file)),
].filter(existsSync);

// The sidebar is the one list of pages. A page that is not in it cannot be
// reached, and an entry without a page is a dead link on every page.
const config = readFileSync(
  path.join(root, "docs/.vitepress/config.ts"),
  "utf8",
);

const linked = new Set(
  Array.from(config.matchAll(/link: "\/([^"]*)"/g), ([, route]) =>
    route === "" ? "index.md" : `${route}.md`,
  ),
);

const pages = docsPages.map((file) =>
  path.relative(path.join(root, "docs"), file),
);

assert.deepEqual(
  pages.filter((page) => !linked.has(page)),
  [],
  "These pages are missing from the sidebar in docs/.vitepress/config.ts",
);
assert.deepEqual(
  [...linked].filter((page) => !pages.includes(page)),
  [],
  "These sidebar entries have no page",
);

// Every miss is collected rather than thrown at the first one: a single dead
// link per run turns fixing a set of them into a set of round trips.
const broken = [];
let checked = 0;

for (const file of sources) {
  const markdown = readFileSync(file, "utf8");

  if (relative(file).startsWith("docs/")) {
    const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";

    assert.match(
      frontmatter,
      /^description: "[^"\n]+"$/m,
      `${relative(file)}: missing frontmatter description`,
    );
  }

  assert.doesNotMatch(
    markdown,
    /^\s*(?:<!--\s*)?(?:generated (?:by|with)|co-authored-by:)/im,
    `${relative(file)}: remove an authoring attribution from public documentation`,
  );
  assert.doesNotMatch(
    markdown,
    /\u2014/,
    `${relative(file)}: the project writes without em dashes`,
  );

  // Inline links only. Code fences are left alone because a link inside one is
  // sample text rather than navigation.
  const prose = markdown.replace(/```[\s\S]*?```/g, "");

  for (const [, target] of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) {
      continue;
    }

    checked += 1;

    const [pathname] = target.split("#");

    if (pathname === "") {
      continue;
    }

    if (existsSync(path.resolve(path.dirname(file), pathname))) {
      continue;
    }

    broken.push(`${relative(file)} -> ${target}`);
  }
}

assert.deepEqual(
  broken,
  [],
  `Dead relative links:\n  ${broken.join("\n  ")}\n`,
);
console.log(
  `Verified ${checked} relative links across ${sources.length} markdown sources.`,
);

const output = path.join(root, "docs/.vitepress/dist");
const siteUrl = process.env.DOCS_SITE_URL;

const base =
  process.env.DOCS_BASE_PATH ?? (siteUrl ? new URL(siteUrl).pathname : "/");

const files = existsSync(output)
  ? readdirSync(output, { recursive: true }).filter(
      (file) => file.endsWith(".html") && file !== "404.html",
    )
  : [];

assert.ok(files.length > 0, "Build the documentation before verifying it");
assert.equal(
  files.length,
  pages.length,
  "The build must produce one page per markdown source",
);

const pageIds = new Map();

for (const file of files) {
  const dom = new JSDOM(readFileSync(path.join(output, file), "utf8"));

  pageIds.set(
    file,
    new Set(
      Array.from(
        dom.window.document.querySelectorAll("[id]"),
        (element) => element.id,
      ),
    ),
  );
  dom.window.close();
}

for (const file of files) {
  const dom = new JSDOM(readFileSync(path.join(output, file), "utf8"));
  const document = dom.window.document;

  const meta = (selector) =>
    document.querySelector(selector)?.getAttribute("content");

  assert.ok(document.title.includes("Flare"), `${file}: missing page title`);
  assert.equal(
    document.querySelectorAll("h1").length,
    1,
    `${file}: expected one main heading`,
  );
  assert.equal(
    document.querySelectorAll("main").length,
    1,
    `${file}: expected one main landmark`,
  );

  const origin = new URL(siteUrl ?? "https://docs.local").origin;
  const currentUrl = new URL(`${base}${file}`, origin);

  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    const target = new URL(href, currentUrl);

    if (target.origin !== origin) {
      continue;
    }

    if (/^https?:\/\//i.test(href) && !target.pathname.startsWith(base)) {
      continue;
    }

    assert.ok(
      target.pathname.startsWith(base),
      `${file}: link escapes the configured base: ${target.pathname}`,
    );

    const route = decodeURIComponent(target.pathname.slice(base.length));

    const targetFile =
      route.endsWith("/") || route === ""
        ? `${route}index.html`
        : path.extname(route)
          ? route
          : `${route}.html`;

    assert.ok(
      existsSync(path.join(output, targetFile)),
      `${file}: missing link target ${targetFile}`,
    );

    if (target.hash && pageIds.has(targetFile)) {
      assert.ok(
        pageIds.get(targetFile).has(decodeURIComponent(target.hash.slice(1))),
        `${file}: missing anchor ${targetFile}${target.hash}`,
      );
    }
  }

  assert.ok(meta('meta[name="description"]'), `${file}: missing description`);

  for (const property of ["og:title", "og:description"]) {
    assert.ok(
      meta(`meta[property="${property}"]`),
      `${file}: missing ${property}`,
    );
  }

  for (const image of document.querySelectorAll("img")) {
    assert.ok(image.hasAttribute("alt"), `${file}: image is missing alt text`);
  }

  const icon = document.querySelector('link[rel="icon"]')?.getAttribute("href");

  assert.ok(
    icon?.startsWith(base),
    `${file}: missing icon under the configured base`,
  );
  assert.ok(
    existsSync(path.join(output, icon.slice(base.length))),
    `${file}: missing icon file`,
  );

  // There is no social image yet, so none is asserted. Add the check with it.
  if (siteUrl) {
    const expected = new URL(
      file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, ""),
      `${siteUrl.replace(/\/$/, "")}/`,
    ).href;

    assert.equal(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      expected,
      `${file}: incorrect canonical URL`,
    );
    assert.equal(
      meta('meta[property="og:url"]'),
      expected,
      `${file}: incorrect Open Graph URL`,
    );
  }

  dom.window.close();
}

if (siteUrl) {
  const robots = readFileSync(path.join(output, "robots.txt"), "utf8");

  const sitemapUrl = new URL("sitemap.xml", `${siteUrl.replace(/\/$/, "")}/`)
    .href;

  assert.ok(
    robots.includes(`Sitemap: ${sitemapUrl}`),
    "robots.txt must link to the deployed sitemap",
  );
  assert.ok(
    existsSync(path.join(output, "sitemap.xml")),
    "Missing sitemap.xml",
  );
}

console.log(
  `Verified titles, headings, links, anchors and metadata for ${files.length} documentation pages.`,
);
