# Acosta Browse

The Acosta AI desktop browser — a study-focused browser for Australian high school students (NSW curriculum), built by [Acosta AI](https://heyacosta.com).

Acosta Browse is a fork of [Deta Surf](https://github.com/deta/surf) (Apache 2.0), keeping its excellent tab system, split view, notebook infrastructure and ad blocker, with Acosta's education layer built on top.

## What's different from Surf

- **Acosta AI everywhere** — every AI call goes through the Acosta proxy (`api.acosta.ai`) with the student's Firebase ID token as the bearer key. The model picker offers Claude (default), Gemini and ChatGPT — no bring-your-own-key. Every chat carries the Acosta tutor system prompt (NSW curriculum aware, age-appropriate, academic-integrity protected).
- **Firebase auth** — full-screen branded login (email/password + Google Sign-In) before the browser loads. Sessions persist across launches; auth state lives in the main process and is shared with every window over IPC.
- **Content filtering** — always-on filtering of adult content, gambling, drugs and violence (StevenBlack host lists, cached weekly, plus embedded seed lists and AI URL screening via `api.acosta.ai/content-check`), optional social media and gaming blocks, forced safe search on Google/Bing/DuckDuckGo and YouTube restricted mode. Blocked sites show a branded page with a "Request Access" flow to the student's teacher/parent. Filtering degrades gracefully to blocklists-only when the AI endpoint is unreachable.
- **Focus mode** — Pomodoro study sessions (`Cmd/Ctrl+Shift+F` or the toolbar bolt) with a per-session site allowlist enforced at the network layer, a countdown chip, a gentle task reminder when drifting, break prompts, and a session summary saved to `api.acosta.ai/study-sessions`.
- **Study tools** — right-click any selection on a page for _Explain this_, _Quiz me on this_, _Add to Study Notes_, _Summarise_ and _Find in NSW Syllabus_; results land in the AI sidebar (`Cmd/Ctrl+Shift+A`). Study notes organise into per-subject notebooks (NSW Stage 4/5 subjects plus custom ones).
- **Acosta new tab page** — greeting with the student's name, quick links to the Acosta platform (Study Plan, Exam Simulator), today's focus subject, and a daily AI-generated motivational quote (cached locally, with offline fallbacks).
- **Rebrand** — `acosta://` / `acosta-internal://` protocols, Acosta navy/teal design system, Bricolage Grotesque + Geist fonts, `com.acostai.browse` bundle id, auto-updates from `updates.acosta-ai.com`.

## Development

Requires Node ≥ 22.18, Yarn 1.x and a Rust toolchain (for the Surf backend).

```bash
yarn install
cp app/.env.example app/.env   # fill in Firebase keys, or set M_VITE_ACOSTA_DEV_BYPASS_AUTH=true
yarn dev
```

## Building

```bash
yarn build:packages            # workspace libs + Rust backend
yarn build:desktop:mac         # DMG (run x64 + arm builds for universal coverage)
yarn build:desktop:win:x64     # NSIS installer
```

Release artifacts publish to the generic update feed configured in `app/build/electron-builder-config.js` (`UPDATES_URL`, default `https://updates.acosta-ai.com`). Code signing identities are placeholders until certificates are provisioned.

## Project layout

- `app/src/main` — Electron main process. Acosta modules live in `app/src/main/acosta/` (auth service, Acosta API client, content filter, blocklists, safe search, focus mode, enforcement wiring, auto-updater, IPC).
- `app/src/renderer` — Svelte 5 renderer surfaces: `Core` (browser chrome), `Login`, `Blocked`, `NewTab`, `Settings`, `Resource` (notebooks + AI chat), `PDF`, `Overlay`.
- `packages/` — shared workspace packages (`@deta/services`, `@deta/types`, `@deta/ui`, …) plus the Rust backend (`packages/backend`, `packages/backend-server`).

Upstream Surf documentation for the inherited systems lives in [docs/](./docs/).

## Licence

The source code is licensed under Apache 2.0, same as upstream Deta Surf, with the exceptions noted by upstream:

1. The patch for the @ghostery/adblocker-electron package is licensed under MPL-2.0.
2. Select files may contain their own specific licence headers that override the default.

See [LICENSE](LICENSE) for details. The Deta name and logos are **not** covered by the Apache 2.0 licence and remain the property of their owners; this fork replaces them with Acosta branding.
