# Conventions

## Naming

- React components: `PascalCase.tsx`.
- Hooks: `useX.ts`.
- Zustand stores: `useXStore.ts`.
- SCSS modules: `Component.module.scss`.
- Route-local helpers live near the route in `lib/`, `model/` or `ui/`.

## Import Rules

- Use alias `@/*`.
- Prefer public barrel exports when a module already has `index.ts`.
- Do not import route-local internals into reusable modules.
- Keep domain imports explicit: reusable UI should not know page-level routes unless that is its job.

## Module Boundaries

- `app` owns providers, routing, viewport and application setup.
- `pages` owns route composition.
- `widgets` owns composed screen blocks.
- `entities` owns domain types and pure domain rules (level format, board rules, level catalog).
- `shared` owns reusable infrastructure and UI primitives.

## API Rules

- There is no API layer: no transport, no auth, no mocks, no TanStack Query or RTK Query.

## Env Rules

- Browser env is build-time configuration. Changing container runtime env does not change an already built bundle.
- Local development uses standard `.env*`; CI uses GitLab File variable `BUILDS_ENV` materialized as `builds_file.env`.
- Keep `BUILDS_ENV` as File variable. Do not inline `${BUILDS_ENV}` into `BUILDS_ENV_STRING`; for File variables it is a path, not the file content.
- Add new `VITE_*` variables to `src/vite-env.d.ts`, `config/buildEnv.ts` validation when required, and `README.md`. Read `import.meta.env` in the owning module: there is no runtime env facade.

## CSS / Styles

- Default strategy: SCSS Modules.
- Shared global style entry: `src/app/styles/index.scss`.
- Shared SCSS primitives live in `src/shared/styles`.
- Prefer component-local CSS modules for UI.
- Inline styles are acceptable for tiny runtime CSS variable overrides, not as the main styling strategy.
- For fullscreen layout, the content column (`app-frame`) and game insets, follow [responsive-layout.md](./responsive-layout.md).

## Asset Rules

- URL-addressed static assets live in `public/` and are referenced from JS/TSX through `src/shared/lib/assets`.
- SVG icons that should render as React components live in `src/assets` and are imported with `*.svg?react`.
- Exception: game textures and element icons belong to the skin folder (`src/entities/skin/skins/<name>/images|icons`) and are imported with `?url`; read them through the skin registry (`getElementIcon`, `listSkinTextureFiles`), not by path (`docs/skin.md`).

## TypeScript Rules

- Keep `strict` assumptions.
- Type public contracts explicitly.
- Prefer `type` imports where ESLint requires them.
- Avoid `any` unless the boundary is genuinely unknown and narrowed immediately.

## Public API Pattern

If a folder has `index.ts`, use it as the public API. If a folder does not have a barrel, direct file imports are acceptable until a real public surface is needed.

Add a barrel only when it clarifies ownership or prevents repeated deep imports.

## Layers, Texts, Storage

- Layers import only downward: `app → pages → widgets → features → entities →
shared`; cross-layer imports use the `@/` alias. ESLint enforces it
  (`layerBoundaries` in `eslint.config.js`), `barrelPixiFree.test.ts` keeps
  `@/widgets/game` free of Pixi, GSAP and Spine.
- User-visible strings live in the layer's text dictionary (`texts.ts`, see
  [extending.md](./extending.md#тексты)); Russian only, no i18n runtime.
- `localStorage` keys come from `STORAGE_KEYS` only
  (`shared/constants/model/storageKeys.ts`).

## Documentation Sync

Documentation changes with code.

Update `CLAUDE.md`, `AGENTS.md` and relevant `docs/*` when changing:

- routes;
- app shell/providers;
- state responsibilities;
- viewport/insets contract;
- public exports;
- style conventions.
