import { createReportBackend } from "src/backend/createReportBackend";
import { createProviders } from "src/providers/createProviders";
import { createLedgerRuntime } from "src/reporting/createLedgerRuntime";
import { INITIAL_ACCOUNT } from "src/utils/constants/accounts";
import { switchAccount } from "src/utils/switchAccount";

/**
 * The backend, the SDKs and the first runtime, signed in and started. It runs
 * once, outside React, where Strict Mode cannot start a runtime twice.
 */
export const startLedger = ({ latency }: { latency: number }) => {
  const backend = createReportBackend({ latency });
  const providers = createProviders();
  const runtime = createLedgerRuntime({ backend, providers });

  switchAccount(runtime.flare, providers, INITIAL_ACCOUNT);
  runtime.flare.start();

  return { backend, providers, runtime };
};
