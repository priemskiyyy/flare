import { formatDuration } from "examples/shared/ledger/formatting/formatDuration";
import { formatShortId } from "examples/shared/ledger/formatting/formatShortId";
import { createReportServer } from "src/createReportServer";

const port = Number.parseInt(process.env.PORT ?? "4388", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const host = createReportServer();

host.backend.requests.subscribe(() => {
  const [latest] = host.backend.requests.getSnapshot();

  if (latest === undefined) {
    return;
  }

  console.log(
    `report ${formatShortId(latest.reportId)} from ${latest.account ?? "anonymous"}: ${latest.outcome} in ${formatDuration(latest.duration)}`,
  );
});

host.server.listen(port, "0.0.0.0", () => {
  console.log(`Ledger report endpoint: http://localhost:${port}/api/reports`);
});

const shutdown = () => {
  host.dispose().catch(console.error);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
