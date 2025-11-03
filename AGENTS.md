# Repository Guidelines

## Project Structure & Modules
- Source: `src/` (React + Vite); components in `*.jsx`, services in `src/services/` (API/data access), styles in `src/index.css`.
- Public assets: `public/`; built output: `dist/`.
- **Architecture Docs**: `docs/app-architecture/` — comprehensive documentation of system architecture, data flow, and implementation patterns. **Start here** before making changes.
- Setup Docs: `docs/` (e.g., `SUPABASE_SETUP.md`, `MAPBOX_SETUP.md`).
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

## Documentation Maintenance

### Architecture Documentation (`docs/app-architecture/`)

This folder contains living documentation that must be updated when making architectural changes.

**Core Documentation**:
- `00-overview.md` - Application overview, capabilities, statistics
- `01-architecture-principles.md` - Design philosophy, architectural decisions
- `02-tech-stack.md` - Technology inventory with rationale
- `03-data-flow.md` - Visual flow diagrams for all search modes
- `04-state-management.md` - Context provider architecture

**Context Documentation** (`contexts/` subdirectory):
- `SearchContext.md` - Search orchestration (update when adding search modes)
- `MapContext.md` - Map visualization (update when adding boundary types)
- `ResultsContext.md` - Data storage (update when adding result types)
- `UIContext.md` - Presentation state (update when adding UI elements)

**When to Update Documentation**:
- Adding new search mode → Update `SearchContext.md` + `03-data-flow.md`
- Adding new service → Update `02-tech-stack.md` + service-specific docs
- Modifying state structure → Update relevant context documentation
- Changing data flow → Update `03-data-flow.md`
- Adding new dependencies → Update `02-tech-stack.md`
- Architectural decisions → Update `01-architecture-principles.md`

**Documentation Style**:
- Use code examples with actual implementation snippets
- Include file paths with line numbers for reference
- Document "why" not just "what"
- Provide usage examples for complex patterns
- Keep code snippets up-to-date with actual implementation
