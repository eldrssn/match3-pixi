# Engineering Rules

## 0. Graph First

- Before codebase search, architecture analysis, owner lookup, or raw file reading, run `graphify query "<question>" --budget 1200` when `graphify-out/graph.json` exists.
- Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
- Read only files and line locations returned as `src=... loc=...` before broadening the search.
- Do not start with broad `rg`, `find`, `src/`, `docs/`, or `GRAPH_REPORT.md` reads unless graphify is missing or its narrowed answer was insufficient.
- After code changes, run `graphify update .` to keep the graph current.

## 1. Runtime Boundaries

- Verify the owning runtime seam before editing.
- Keep route composition in `pages`/`app/routing`.
- Keep reusable behavior in `shared` only when it is genuinely reusable.
- Do not revive project-specific contracts from other repositories without checking the current code.

## 2. Architecture

- Prefer the existing Vite + React Router + Zustand shape.
- Add abstractions only when they remove real duplication or clarify ownership.
- Keep public APIs small and explicit.

## 3. State And Events

- Cross-screen local state belongs in a named Zustand store.
- Temporary view state belongs in React local state.
- Avoid hidden global state unless it wraps a real browser/native runtime singleton.

## 4. Performance

- Lazy-load route screens when they are not needed for initial boot.
- Preload assets only when they are required for a specific startup or transition gate.

## 5. Rendering

- Use SCSS Modules for component styling.
- Keep fullscreen layout inside the app shell (`App`) and page content inside the `app-frame` column.
- Avoid raw `100vh` (use `app-height` / `--app-viewport-height`) and unreviewed fixed positioning.
- Keep text and controls inside stable containers; avoid layout shifts from dynamic labels.

## 6. Assets And Loading

- URL-addressed static assets live in `public/` under type subfolders (`images/`, `fonts/`); SVG icons rendered as React components live in `src/assets` and are imported with `*.svg?react`.
- Reference public assets from JS/TSX via `src/shared/lib/assets` (BASE_URL-aware); from CSS use absolute `/...` paths like `/fonts/...`.
- Game textures (skin files, `src/entities/skin/skins/<name>/images`) are warmed when a party starts (`warmGameAssets`); document any new preload gate in `docs/game-flow.md` before adding it.
- Element labels, icons, texture keys, particle tints and mechanic tips live only in the skin (`src/entities/skin`, see `docs/skin.md`); `src/entities/game` never imports presentation.

## 7. Configuration

- Document every new `VITE_*` env variable in `README.md` or the owning doc.
- Keep dev-only switches explicit.
- Do not depend on branch names for runtime behavior unless CI contract says so.

## 8. Type Safety

- Keep TypeScript strict.
- Type exported contracts.
- Narrow unknown external payloads (query flags, level JSON) at the boundary.

## 9. Maintainability

- Keep edits scoped to the owning module.
- Do not mix unrelated refactors with feature changes.
- Respect dirty/untracked worktree boundaries.
- Keep docs synchronized with code changes.

## 10. Review Checklist

- Did routes or public exports change?
- Did env contract change?
- Did state ownership change?
- Did viewport/insets behavior change?
- Did shared style/layout rules change?
- Did docs update in the same task?
