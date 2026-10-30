# Widget flotante de pendientes — Grupo CESA

Windows Electron widget. The full plan is in `docs/PLAN.md`; `README.md` explains how to run it; `docs/MANUAL_TESTS.md` lists the checks that need a human.

Stack: Electron, electron-vite, React 19, Tailwind v4 (tokens in `src/renderer/assets/main.css`), Zustand, zod, Vitest, `node:sqlite` + Drizzle, safeStorage for secrets. Commands: `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

## Decisions to keep
- Read-only integrations (ClickUp, Google Calendar/Gmail, Slack). ClickUp client exposes only GET.
- Phase 8 (daily summary) is authorized and in progress. The AI is Gemini with the user's own key (stored in `secrets.bin`, never in settings, logs or the repo), and it is used ONLY to write the daily summary. It works without AI (rules summary is the fallback), sends the minimum by default (meeting + ClickUp titles; mail/Slack only as counts unless the user opts in per source), masks sensitive text, and records every request in `ai_audit_log`. Gemini model names change often: check docs before changing the default in `settingsSchema.ts`.
- Work phase by phase; the user authorizes each one. Installer (electron-builder NSIS, autostart, auto-update, keep userData stable) is still pending.
- Never commit or log secrets. Credentials live encrypted in `%APPDATA%\widget\secrets.bin`; logs in `%APPDATA%\widget\logs`.
- Tests must NEVER delete `%APPDATA%\widget` or kill every electron process: use an isolated `--user-data-dir` and kill by PID.
- The content of "Fuentes y filtros" (formerly "Qué vigilar") is not to be removed.
- UI text is in Spanish and lives in `src/shared/strings.ts`. Accessibility rules: text >= 12px, targets >= 24px, visible focus, respect reduced motion.
- Slack is not decided yet: the free workspace allows only 10 apps and the user does not want to pay. Proposal: one company Slack app with per-user OAuth (PKCE) and polling instead of Socket Mode. Not built; `docs/slack-app-manifest.json` is for the current Socket Mode design.
- Google: each person currently creates their own Cloud project. For 30 people a single company project (Internal consent screen if Google Workspace) is better.

## Gotchas
- In PowerShell, writing code with backticks or `${...}` inside double-quoted strings silently breaks template literals. Use the Edit tool.
- Dismissed items go to the trash (Ajustes > Papelera); `purge` empties them for good.
