# Service tests

The OpenTelemetry adapter over the real `@opentelemetry/sdk-logs` and its OTLP HTTP exporter, sending to a real OpenTelemetry Collector in Docker. The collector writes what it received to a file, and the tests read it back. Everything runs locally.

## Run

Prerequisites: Docker with Compose. The first run downloads the collector image.

```sh
pnpm build
pnpm test:services
```

`pnpm test:services` starts the collector, runs the tests and stops it again, also when a test fails. To keep it running between runs:

```sh
pnpm --filter test-services services:up
pnpm --filter test-services test
pnpm --filter test-services services:down
```

`services:down` removes this suite's container, network and output, and nothing else. The collector binds to loopback only:

| Service        | Address                  | Implementation                                                         |
| -------------- | ------------------------ | ---------------------------------------------------------------------- |
| OTLP over HTTP | `http://127.0.0.1:54318` | `otel/opentelemetry-collector-contrib:0.161.0`, with the file exporter |
| Health check   | `http://127.0.0.1:54313` | The collector's `health_check` extension, which the tests wait for     |

The collector runs as your own user, so the file it writes to `.output/` can be read back on Linux, where a bind mount keeps the container's ownership.

## Coverage

- A captured exception reaches the collector with its severity, body and capture time, and with every attribute: the exception, the user, the report id, and the tags, contexts and breadcrumbs as nested OTLP values, with a sensitive value redacted and the original nowhere in the export.
- A message reaches it at its own severity, with its text as the body.
- `flare.flush()` returns `flushed` for the destination.

The suite runs in its own CI workflow and before every release. It is not part of `pnpm check`, which needs no Docker.

## Troubleshooting

```sh
docker compose -f tests/services/compose.yaml ps
docker compose -f tests/services/compose.yaml logs collector
```

## Limits

The collector accepts and writes what it received; no backend behind it is tested. The OTLP protobuf and gRPC exporters, batching processors and TLS are not covered.
