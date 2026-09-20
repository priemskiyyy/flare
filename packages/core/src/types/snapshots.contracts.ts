// Typechecked, never imported: published snapshots can be read and copied,
// while mutations must fail before they reach frozen runtime values.
import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { DestinationHandle } from "src/types/DestinationHandle";
import type { DestinationStatus } from "src/types/DestinationStatus";
import type { FlareSnapshot } from "src/types/FlareSnapshot";
import type { FlareStatus } from "src/types/FlareStatus";
import type { ReceiptStatus } from "src/types/ReceiptStatus";
import type { SanitizedReport } from "src/types/SanitizedReport";

declare const report: SanitizedReport;
declare const ambient: AmbientSnapshot;
declare const receipt: ReceiptStatus;
declare const runtimeStatus: FlareStatus;
declare const destinationStatus: DestinationStatus;
declare const diagnostics: FlareSnapshot;
declare const destination: DestinationHandle;

// @ts-expect-error -- counts belong to the diagnostic snapshot.
diagnostics.pendingReceipts = 42;
// @ts-expect-error -- observers cannot remove configured destinations.
diagnostics.destinations.pop();
const inspected = diagnostics.destinations[0];
if (inspected !== undefined) {
  // @ts-expect-error -- destination observations are frozen.
  inspected.buffered = 42;
  // @ts-expect-error -- capabilities describe the adapter rather than configure it.
  inspected.capabilities.messages = false;
}
// @ts-expect-error -- a handle cannot replace its declared capabilities.
destination.capabilities = { ...destination.capabilities };
// @ts-expect-error -- nested capability observations are frozen too.
destination.capabilities.eventLocal.contexts = false;

// @ts-expect-error -- observing runtime state does not grant control over it.
runtimeStatus.state = "disposed";
// @ts-expect-error -- destination state belongs to its lifecycle owner.
destinationStatus.state = "disposed";

// @ts-expect-error -- the report itself is frozen.
report.level = "warning";
// @ts-expect-error -- tag dictionaries are frozen.
report.tags.area = "changed";
// @ts-expect-error -- context dictionaries are frozen.
report.contexts.request = {};
const context = report.contexts.request;
if (context !== undefined) {
  // @ts-expect-error -- individual contexts are frozen too.
  context.attempt = 2;
}
// @ts-expect-error -- identity belongs to the capture-time snapshot.
report.identity.generation = 4;
if (report.identity.user !== null) {
  // @ts-expect-error -- reported traits are frozen even though input users are mutable.
  report.identity.user.id = "another account";
}
if (report.kind === "exception") {
  // @ts-expect-error -- normalized error fields are frozen.
  report.exception.message = "changed";
  // @ts-expect-error -- the cause list belongs to the normalized exception.
  report.exception.causes = [];
}
const breadcrumb = report.breadcrumbs[0];
if (breadcrumb !== undefined) {
  // @ts-expect-error -- each retained breadcrumb is frozen.
  breadcrumb.timestamp = 0;
}
const loss = report.losses[0];
if (loss !== undefined) {
  // @ts-expect-error -- published mapping losses are frozen.
  loss.path = "changed";
}
// @ts-expect-error -- ambient snapshots have the same ownership as report data.
ambient.user = null;
if (receipt.state === "settled") {
  const outcome = receipt.outcomes.primary;
  if (outcome?.status === "submitted") {
    // @ts-expect-error -- provider evidence is frozen before publication.
    outcome.event = { id: "changed" };
    if (outcome.event !== null) {
      // @ts-expect-error -- the provider event reference is frozen too.
      outcome.event.id = "changed";
    }
  }
  // @ts-expect-error -- callers cannot replace a destination's answer.
  receipt.outcomes.primary = { status: "failed", error: "changed" };
}
// @ts-expect-error -- receipt state is an observed snapshot.
receipt.state = "pending";

// Consumers can make an editable copy when mapping into their provider API.
const tags = { ...report.tags };
tags.area = "provider-owned";
const user = { ...report.identity.user, id: "provider-owned" };
user.id = "updated";
