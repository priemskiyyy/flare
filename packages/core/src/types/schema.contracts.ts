// Typechecked, never imported: these assignments fail compilation if schema
// inference stops carrying names and value types to the public API.
import type { BreadcrumbsOf } from "src/types/BreadcrumbsOf";
import type { ContextsOf } from "src/types/ContextsOf";
import type { FlareSchema } from "src/types/FlareSchema";
import type { StandardSchema } from "src/types/StandardSchema";
import type { TagsOf } from "src/types/TagsOf";

declare const schemaOf: <TValue>() => StandardSchema<TValue>;

export const typed = {
  tags: { area: schemaOf<"upload" | "editor">() },
  contexts: { upload: schemaOf<{ kind: "avatar"; attempt: number }>() },
  breadcrumbs: { uploadStarted: schemaOf<{ kind: "avatar" }>() },
} satisfies FlareSchema;

type Typed = typeof typed;

export const typedTags: TagsOf<Typed> = { area: "upload" };
export const typedContexts: ContextsOf<Typed> = {
  upload: { kind: "avatar", attempt: 1 },
};
export const typedBreadcrumbs: BreadcrumbsOf<Typed> = {
  uploadStarted: { kind: "avatar" },
};

// @ts-expect-error -- "billing" is not a declared area.
export const wrongTagValue: TagsOf<Typed> = { area: "billing" };

// @ts-expect-error -- "plan" is not a declared tag.
export const unknownTag: TagsOf<Typed> = { area: "upload", plan: "pro" };

export const wrongContext: ContextsOf<Typed> = {
  // @ts-expect-error -- attempt must be a number.
  upload: { kind: "avatar", attempt: "1" },
};

// Without a schema, any name and any scalar is accepted.
export const untypedTags: TagsOf<FlareSchema> = { anything: 1, goes: true };
export const untypedContexts: ContextsOf<FlareSchema> = { any: { thing: 1 } };

// @ts-expect-error -- a tag is scalar even without a schema.
export const untypedObjectTag: TagsOf<FlareSchema> = { nested: { no: true } };
