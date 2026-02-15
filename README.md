# RP Frontend (SillyTavern-style)

An open source roleplay frontend app focused on:

- Character management (V2 JSON + PNG metadata card import)
- World Info / Lorebook keyword trigger injection
- Preset import/export with template variables
- Markdown chat UI
- Token and context sliding window visibility
- Extensible adapter layer for OpenAI / Claude / KoboldCPP

## Tech Stack

- React + TypeScript + Vite
- Zustand for global state
- `react-markdown` for message rendering

## Run

```bash
npm install
npm run dev
```

## GitHub Actions

- `CI`: runs on push/PR and validates `npm run build`
- `Release`: runs when pushing a semver tag like `v0.1.0`
  - Builds the app
  - Packs `dist` into `rp-frontend-vX.Y.Z.zip`
  - Generates `rp-frontend-vX.Y.Z.zip.sha256`
  - Creates a GitHub Release and uploads that zip asset
- `Deploy Pages`: publishes the web app to GitHub Pages on every push to `main`

## Android Usage (PWA)

This project is now configured as an installable PWA for Android:

- Open the GitHub Pages URL in Chrome
- Tap the in-app `Install To Home Screen` button or browser install prompt
- Launch it like a native app from your home screen

Notes:

- API calls still depend on your backend endpoint and CORS policy.
- For phone access, prefer HTTPS endpoints and avoid localhost-only APIs.

### Release Steps

```bash
npm version patch
git add .
git commit -m "release: vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

If you prefer manual tag naming:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or use the helper script:

```bash
npm run release:tag -- -Version v0.1.0
```

## Core Features Implemented

- Character import:
  - `.json`: parse standard V2 card format
  - `.png`: parse `tEXt/zTXt/iTXt` metadata blocks
  - Supports common `chara` (base64 JSON) metadata and plain JSON metadata values
- Worldbook import:
  - JSON import with entries + key/keys field compatibility
  - Keyword trigger logic checks conversation text and injects matched entries into system context
- Presets:
  - JSON import/export
  - Supports `contextTemplate`, `postHistoryInstructions`, `stopSequences`, `maxContextTokens`
  - Template variables: `{{user}}`, `{{char}}`, `{{description}}`, `{{personality}}`, `{{scenario}}`
- Context assembly:
  - System prompt composition from character + preset + lorebook
  - Sliding window by token budget
- Adapter pattern:
  - `src/api/adapters/openai.ts`
  - `src/api/adapters/claude.ts`
  - `src/api/adapters/kobold.ts`
  - Add new providers by implementing `LlmAdapter`

## Structure

```text
src/
  api/adapters/        # Provider adapters
  lib/                 # Importers, parser, context builder, template/token utils
  store/               # Zustand app state and chat flow
  types/               # Shared domain types
  App.tsx              # Main UI
```

## Notes

- Token counting currently uses a lightweight estimation (`chars / 4`) for UI and context window budgeting.
- You can swap in a tokenizer per provider/model for exact accounting.
- Store now persists to browser localStorage (API Key is intentionally not persisted).
