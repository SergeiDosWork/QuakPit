# AGENTS.md

Quakpit — Electron (electron-vite) menubar app for macOS: a duck in a plane flies across the screen before your calendar meetings. TypeScript (strict), vanilla TS/HTML/CSS renderers — no UI framework. UI and code comments are English.

## Commands

```bash
npm install
npm test                                      # vitest run
npx vitest run src/main/calendar/ews.test.ts  # single test file
npx tsc --noEmit                              # type-check (what CI gates on)
npm run build                                 # gen:icons + electron-vite build -> out/
npm run dist:mac                              # build + electron-builder -> dist/ (universal dmg + zip)
```

- There is no linter/formatter config. CI (`.github/workflows/ci.yml`) is exactly `npm ci && npx tsc --noEmit && npm run build` on macOS, Node 20 — **CI does not run tests**, so run `npm test` yourself.
- Tests are co-located as `*.test.ts` next to the source (vitest, no config file).
- `npm run gen:icons` runs automatically before `dev`/`build` and regenerates `build/icon.png` and tray icons (gitignored) with zero-dependency scripts in `scripts/`. Don't commit generated icons; don't be surprised that `electron-builder.yml` references a gitignored `build/icon.png`.
- Unsigned local packaged test: `npm run build && CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --dir`.
- Running `npm run dev` from an automated/agent shell usually fails silently: if `ELECTRON_RUN_AS_NODE=1` is set, Electron opens no GUI. Use `env -u ELECTRON_RUN_AS_NODE npm run dev`, or let the user run dev from their own terminal.

## Architecture

- Three electron-vite targets (`electron.vite.config.ts`): **main** (`src/main/index.ts`), **preload** (`src/preload/index.ts`), **renderer** with two separate HTML apps: `src/renderer/overlay/` (the flight animation) and `src/renderer/settings/` (the settings window). `site/` is just the static landing page, not part of the app.
- IPC spans three files that must stay in sync: channel handlers in `src/main/ipc.ts`, the safe `window.quakpit` bridge in `src/preload/index.ts`, and renderer typings in `src/renderer/quakpit.d.ts`. Add a feature to all three.
- Calendar providers live in `src/main/calendar/` (google, icloud CalDAV, ical/ICS feeds, exchange/EWS) behind the facade `src/main/calendar/index.ts`, which merges and dedupes events. Provider failures are swallowed (`.catch(() => [])`) — a broken provider must never crash the app.
- `src/main/scheduler.ts` polls upcoming events every 60 s and fires flights within a 90 s window. Event ids can contain `:` (e.g. `ical:abc`), so dedupe/fired keys use prefix matching, never splitting on `:`.
- Persistence in `src/main/store.ts`: `prefs.json` is plain JSON in `userData`; everything sensitive (Google OAuth token, iCloud/Exchange creds, iCal feed list) is encrypted via `safeStorage` into `*.bin` files.

## Hard constraints

- **Privacy is a core product promise** (README): no server, no telemetry/analytics, calendar events kept in memory only and never written to disk. Don't add event logging, disk persistence of event data, or any network call except the calendar/license endpoints.
- The app is open-core and must stay fully functional for free (MIT). Licensing (Pro/Polar) was removed in commit `0265c35`; the README still contains stale "Pro"/Polar sections, and a few "Pro" mentions remain in comments/`Prefs` fields — treat licensing as gone, don't reintroduce or build on it.

## Development setup

- Google Calendar needs the user's own OAuth client: copy `oauth-credentials.example.json` to `oauth-credentials.json` (gitignored) with a Google "Desktop app" client, or paste credentials in-app (Settings → Calendar). See README "Connect Google Calendar". Without it, Google stays unconfigured; iCloud/iCal/Exchange work without setup.
- macOS packaging/notarization details (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, auto-update via `electron-updater` + GitHub releases) are documented in `electron-builder.yml` comments and the README "Build a macOS app" section.
