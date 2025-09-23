# Repository Guidelines

## Project Structure & Modules
- Source: `src/` (React + Vite); components in `*.jsx`, services in `src/services/` (API/data access), styles in `src/index.css`.
- Public assets: `public/`; built output: `dist/`.
- Docs: `docs/` (e.g., `SUPABASE_SETUP.md`, `MAPBOX_SETUP.md`).
- Utility scripts: `scripts/` (data import, local API servers).
- Tests and fixtures: `tests/` (e.g., `test-zip-boundaries.js`).

## Build, Test, and Development
- Dev server: `npm run dev` — starts Vite at `http://localhost:5173`.
- Lint: `npm run lint` — runs ESLint on the project.
- Build: `npm run build` — creates production assets in `dist/`.
- Preview: `npm run preview` — serves the built app locally.
- API integration test: `node tests/test-zip-boundaries.js` — exercises the ZIP boundaries API (requires network access).

## Coding Style & Naming
- Language: JavaScript (ES modules) and JSX; functional components + hooks.
- Indentation: 2 spaces; include semicolons.
- File naming: React components PascalCase (e.g., `GeoApplication.jsx`), services camelCase (e.g., `zipCodeService.js`).
- Linting: ESLint with `@eslint/js`, React Hooks, and Vite Refresh configs (`eslint.config.js`). Fix issues before PRs.

## Testing Guidelines
- Tests live in `tests/` and are Node scripts; name as `test-*.js`.
- Prefer small, focused scripts that validate a feature or endpoint.
- Run relevant tests locally before submitting; avoid committing external endpoints or secrets.

## Commits & Pull Requests
- Commits: short, imperative summaries (e.g., "Fix map layer selector"). Group related changes.
- PRs must include: clear description, scope of changes, any related issue IDs, and screenshots/GIFs for UI changes.
- Before opening a PR: run `npm run lint`, validate `npm run build`, and confirm affected tests/scripts pass.

## Security & Configuration
- Environment: use `.env` locally and `.env.production` for production defaults. Never commit secrets.
- API keys: see `docs/SUPABASE_SETUP.md` and `docs/MAPBOX_SETUP.md` for required keys and setup.
- Deployment: `vercel.json` provides deployment configuration; static assets are served from `dist/` after build.
