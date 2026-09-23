import { createReportBackend } from "examples/shared/ledger/backend/createReportBackend";
import { INITIAL_ACCOUNT } from "examples/shared/ledger/constants/accounts";
import { createProviders } from "examples/shared/ledger/providers/createProviders";
import { createLedgerRuntime } from "examples/shared/ledger/reporting/createLedgerRuntime";
import { switchAccount } from "examples/shared/ledger/utils/switchAccount";

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
