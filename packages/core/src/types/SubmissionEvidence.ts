/**
 * The furthest boundary a submission is known to have reached, from weakest
 * to strongest. None of them claims that a provider stored, processed or
 * displayed the report.
 *
 * - `sdk-call-returned`: the provider SDK's capture call returned.
 * - `sdk-callback-completed`: the SDK called back, which for some SDKs means
 *   delivered or merely queued for later delivery.
 * - `backend-acknowledged`: a backend answered for this exact report.
 */
export type SubmissionEvidence =
  "sdk-call-returned" | "sdk-callback-completed" | "backend-acknowledged";
