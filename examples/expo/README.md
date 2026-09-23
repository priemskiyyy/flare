# Ledger on Expo

Ledger as a React Native app. Unlike the web examples, its reports leave the app: they travel over the network to the fixture server in `examples/server`, the way a mobile client sends them to your API.

```sh
pnpm build
pnpm dev:server
cp examples/expo/.env.example examples/expo/.env
pnpm --filter example-expo dev
```

The iOS simulator and the web export reach the server at `localhost`. The Android emulator reaches your computer at `10.0.2.2`, so set `EXPO_PUBLIC_REPORTS_URL` in `.env` to `http://10.0.2.2:4388/api/reports`. On a physical device, use your computer's LAN address, such as `http://192.168.1.20:4388/api/reports`; `localhost` on the phone is the phone.

How it fits together:

- `src/reporting/flare.ts` declares the one Flare: your API through `@priemskiyyy/flare-http`, with a `request` that posts each report with its id as the idempotency key, and the console through `@priemskiyyy/flare-console`, which prints to the Metro terminal. The schema and privacy rules are the shared Ledger ones, so the card token and the IBAN arrive as `[Redacted]`.
- `src/types/Register.d.ts` registers that instance, so `useFlare()` and `useFlareStatus()` are typed without a generic.
- `index.tsx` signs Ada in, starts Flare, wraps the app in `FlareProvider`, and flushes when the app goes to the background, where it may be suspended at any moment.
- `src/Application.tsx` switches accounts with `flare.user(...)` and keeps the latest receipt, which the Latest report card reads as it settles.
- The preview is wrapped in `FlareErrorBoundary`. In development the LogBox covers its fallback, so check the fallback in a release build.

The fixture server keeps its state in memory, so you can change it while the app is open and press a button to see the result:

```sh
curl -X POST localhost:4388/api/control \
  -H 'content-type: application/json' \
  -d '{"offline":true}'
```

`offline` takes a boolean, `failNext: true` fails the next report, and `latency` takes `0`, `400` or `8000` milliseconds. At 8 seconds the request outlives the 3 second timeout, so the outcome is unconfirmed rather than failed, and the server logs the request as aborted. A report the server already accepted is answered again with its first answer, so a retry is recorded once. `pnpm check` typechecks the app, and `pnpm --filter example-expo build` and `build:native` bundle it for web, iOS and Android. Nothing in this repository runs it on a device.
