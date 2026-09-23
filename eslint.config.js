import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

const toRestrictions = (entries) =>
  entries.map(([selector, message]) => ({ selector, message }));

const bannedSyntax = toRestrictions([
  // `consistent-type-assertions` lets `as const` through; it is a cast too.
  [
    "TSAsExpression[typeAnnotation.typeName.name='const']",
    "Do not use as const. Annotate the type, or use satisfies.",
  ],
  ["TSNonNullExpression", "Narrow nullable values before using them."],
  ["TSEnumDeclaration", "Use a string union instead of an enum."],
  ["SwitchStatement", "Use explicit conditional dispatch."],
  [
    "UnaryExpression[operator='void']",
    "Handle promise completion and failures explicitly.",
  ],
  // Logical assignment hides a branch in an operator; a guard clause says
  // what happens when the value is already there.
  ["AssignmentExpression[operator='??=']", "Use explicit assignment."],
  ["AssignmentExpression[operator='||=']", "Use explicit assignment."],
  ["AssignmentExpression[operator='&&=']", "Use explicit assignment."],
  ["ExportAllDeclaration", "List public exports explicitly."],
]);

const relativeImports = toRestrictions([
  [
    "ImportDeclaration[source.value=/^[.]/]",
    "Use src/... imports or public package imports.",
  ],
  [
    "ExportNamedDeclaration[source.value=/^[.]/]",
    "Use src/... imports for public exports.",
  ],
  [
    "ImportExpression[source.value=/^[.]/]",
    "Use src/... imports for dynamic imports.",
  ],
  [
    "TSImportType[source.value=/^[.]/]",
    "Use src/... imports for imported types.",
  ],
]);

const reexports = toRestrictions([
  [
    "ExportNamedDeclaration[source]",
    "Keep explicit re-exports at public package entry points only.",
  ],
]);

const typescriptRules = {
  curly: ["error", "all"],
  "no-else-return": ["error", { allowElseIf: false }],
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/consistent-type-definitions": ["error", "type"],
  // A cast is how a boundary hides a lie about a thrown or provider value;
  // normalization is the only sanctioned way to turn `unknown` into a typed value.
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    { assertionStyle: "never" },
  ],
  "no-restricted-syntax": ["error", ...bannedSyntax, ...relativeImports],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.svelte-kit/**",
      ".artifacts/**",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx,svelte}"],
    rules: {
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: ["const", "let"] },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        {
          blankLine: "any",
          prev: ["singleline-const", "singleline-let"],
          next: ["singleline-const", "singleline-let"],
        },
        { blankLine: "always", prev: "*", next: "block-like" },
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: typescriptRules,
  },
  {
    files: ["packages/**/src/**/*.{ts,tsx}"],
    ignores: [
      "packages/*/src/index.ts",
      "packages/adapters/*/src/index.ts",
      "packages/core/src/mock.ts",
      "packages/core/src/testing.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...bannedSyntax,
        ...relativeImports,
        ...reexports,
      ],
    },
  },
  {
    // React rules only where React runs.
    files: [
      "packages/react/**/*.{ts,tsx}",
      "examples/react/src/**/*.{ts,tsx}",
      "packages/devtools/src/react.ts",
      "packages/devtools/src/react.test.ts",
    ],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
    rules: { ...typescriptRules, "no-undef": "off" },
  },
  {
    // svelte-package rewrites no aliases, so the Svelte binding imports by
    // relative path.
    files: ["packages/svelte/**/*.{ts,svelte}"],
    rules: { "no-restricted-syntax": ["error", ...bannedSyntax] },
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
      },
    },
  },
);
