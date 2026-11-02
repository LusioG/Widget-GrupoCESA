# Widget flotante de pendientes — Grupo CESA

Windows Electron widget. The full plan is in `docs/PLAN.md`; `README.md` explains how to run it; `docs/MANUAL_TESTS.md` lists the checks that need a human.

Stack: Electron, electron-vite, React 19, Tailwind v4 (tokens in `src/renderer/assets/main.css`), Zustand, zod, Vitest, `node:sqlite` + Drizzle, safeStorage for secrets. Commands: `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

## Decisions to keep
- Read-only integrations (ClickUp, Google Calendar/Gmail, Slack). ClickUp client exposes only GET.
- Phase 8 (daily summary) is authorized and in progress. The AI is Gemini with the user's own key (stored in `secrets.bin`, never in settings, logs or the repo), and it is used ONLY to write the daily summary. It works without AI (rules summary is the fallback), sends the minimum by default (meeting + ClickUp titles; mail/Slack only as counts unless the user opts in per source), masks sensitive text, and records every request in `ai_audit_log`. Gemini model names change often: check docs before changing the default in `settingsSchema.ts`.
- Work phase by phase; the user authorizes each one.
- Installer and updates (done): per-user NSIS installer (`electron-builder.yml`), auto-update with `electron-updater` from GitHub Releases of the separate public repo `LusioG/Widget-GrupoCESA-releases`. `npm run release` publishes (needs `GH_TOKEN`). NEVER change `appId` (`com.grupocesa.widget`, must equal `setAppUserModelId`): a different id is a different app and updates stop replacing it. userData is pinned to `%APPDATA%\widget` in `main/index.ts`. The `files` list must keep `'**/*'` first and the migrations include last (the installed app reads `src/main/db/migrations`); `tests/packaging.test.ts` guards this. The installer is unsigned (SmartScreen warns once).
- Never commit or log secrets. Credentials live encrypted in `%APPDATA%\widget\secrets.bin`; logs in `%APPDATA%\widget\logs`.
- Tests must NEVER delete `%APPDATA%\widget` or kill every electron process: use an isolated `--user-data-dir` and kill by PID.
- The content of "Fuentes y filtros" (formerly "Qué vigilar") is not to be removed.
- UI text is in Spanish and lives in `src/shared/strings.ts`. Accessibility rules: text >= 12px, targets >= 24px, visible focus, respect reduced motion.
- Slack: polled every 60 s (like Calendar and Gmail; ClickUp every 3 min) with ONLY the user token (`xoxp-`, scopes `search:read`, `channels:read`, `groups:read`, `im:read`, `mpim:read`, `users:read`), using `search.messages` (`is:dm` and `<@me>`). No Socket Mode and no `xapp-` token (removed). Each person still creates their own Slack app (the free workspace allows only 10 apps and the user does not want to pay); a single company app with per-user OAuth (PKCE) is a possible future change. Not yet tried against real Slack (the `<@id>` mention search is the least certain part).
- Configuration by file (so a person's own Claude can configure the widget): the app keeps `%APPDATA%\widget\config.json` in step with the saved settings (non-secret only) and watches it; a valid edit is applied within seconds through `applySettingsPatch` (`src/main/settingsApply.ts`, the same path as the panel), an invalid one applies nothing and writes `config-error.txt`. The app also writes `CONFIGURAR.md` and `CLAUDE.md` (the guide, text in `src/shared/configGuide.ts`) into that folder, and Ajustes has a "Copiar instrucciones para Claude" button. `docs/CONFIGURAR.md` must equal `CONFIG_GUIDE` (a test checks it: update both when a setting is added). Tokens and accounts are never configurable by file or chat. Polling intervals are NOT configurable yet (constants in `accounts.ts`).
- Google: each person currently creates their own Cloud project. For 30 people a single company project (Internal consent screen if Google Workspace) is better.

## Gotchas
- In PowerShell, writing code with backticks or `${...}` inside double-quoted strings silently breaks template literals. Use the Edit tool.
- Dismissed items go to the trash (Ajustes > Papelera); `purge` empties them for good.
