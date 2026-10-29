# Features Map

Карта текущих модулей и их активных entrypoints. Рантайм партии - Pixi v8 +
GSAP 3 (+ Spine по скину); история порта с Phaser - [PLAN.md](./PLAN.md).

## App

| Модуль            | Назначение              | Entry                                    |
| ----------------- | ----------------------- | ---------------------------------------- |
| `src/app/App.tsx` | root React composition  | `App`                                    |
| `src/app/routing` | route config/rendering  | `AppRoutes`                              |
| `src/app/hooks`   | app-level runtime hooks | `useViewportHeight`, `useIOSGestureHack` |

## Pages

| Модуль                  | Назначение                                                                                                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/main`        | главная `/` - **пример** хоста виджета (удаляется копией шаблона, см. [custom-host.md](./custom-host.md)): «Играть»/«Уровни»/«Витрина»/«Редактор» (`ui/MainActions`), карта уровней (`ui/LevelMap`), витрина механик (`ui/ShowcaseList`), сценарий партии `model/useMainFlowStore` |
| `src/pages/minimalHost` | самый короткий хост `GameScreenLazy` без маршрута - образец для своего хоста, под type-check и lint                                                                                                                                                                                |
| `src/pages/editor`      | конструктор паков уровней (`/editor`, full-width, только с `VITE_ENABLE_EDITOR`)                                                                                                                                                                                                   |

## Features

| Модуль                    | Назначение                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/match3Host` | чистые правила хоста партии: прогресс по паку в `localStorage` и знакомые механики (`model/levelProgress`), выбор уровня, бустеры, предуровневые бустеры и «+ходы» (`model/partyRules`); их берут главная и превью редактора |

## Widgets

| Модуль                          | Назначение                                                                                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/widgets/levelConfigEditor` | dev-конструктор уровней: превью на том же рантайме игры, проверка черновика ботом                                                                                                                                                                                            |
| `src/widgets/game`              | Match-3 виджет: `GameScreenLazy` (пропсы `level`/`boosters`/`preBoosters`/`tutorial`/`paused`/`debug`/`insets`/`seed`/`quality`/`renderer`/`title`, колбэки `onFinish`/`onOutOfMoves`/`onTutorialSeen`/`onExitRequest`/`onError`/`onBoardEvent`), рантайм на Pixi (см. ниже) |
| `src/widgets/modals`            | модалки примера хоста (`levelStart`/`outOfMoves`/`victory`/`defeat`): реестр, Zustand store, active-layer arbitration и content views; редактор их не открывает                                                                                                              |

## Рантайм Партии (`src/widgets/game`)

Баррель `@/widgets/game` без Pixi, GSAP и Spine (`barrelPixiFree.test.ts`);
всё ниже приезжает ленивым чанком `GameScreen` (+ `pixi`, `gsap`; `spine` и
`spineRuntime` - только для скина с видом `spine`). Подробно -
[architecture.md](./architecture.md#рантайм-партии).

| Модуль                           | Назначение                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/bootGameRuntime`            | запуск: `Application` (WebGPU/WebGL, `?renderer=`), загрузки, модули, `IGameRuntime`                                                                           |
| `core/*`                         | `GameRuntimeCore`, `RuntimeLayers`, `RuntimeEvents`, `RuntimeInput`, `destroyApplication`                                                                      |
| `motion/*`                       | `RuntimeMotion` (GSAP на часах тикера, `onFrame`, темп, пауза), `easeNames`, `displayMotion`, `tweenLifetime`                                                  |
| `textures/*`                     | `TextureRegistry`, `loadSkinTextures`, `registerProceduralTextures`                                                                                            |
| `modules/*`                      | `GameLogic`, `BoardStepPlayer`, шапка (`GameGoalsPannel`, `MovesCounter`, `ScoreMeter`, `BoostersContainer`, `ExitButton`, `SoundToggle`), `PerfMonitor` и др. |
| `modules/cells`, `modules/steps` | сущности и виды клеток (`BOARD_VIEWS`, `CELL_VIEW_KINDS`), анимации шагов (`stepAnimationOverrides.ts`)                                                        |
| `fx/*`, `hud/*`                  | эффекты доски (`IBoardFx`, `createBoardFx`), контракт шапки для доски (`IBoardHud`, `createBoardHud`)                                                          |
| `spine/*`                        | `spineSupport`, ленивый `spineRuntime`                                                                                                                         |
| `audio/*`                        | `SoundEngine` на своём `AudioContext`, рецепты `soundRecipes`, `soundPreference`                                                                               |
| `model/*`, `store/*`, `ui/*`     | хуки экрана (`useGameRuntime`, `useMechanicTips`), события доски, `GameStore`, React-разметка                                                                  |

## Entities

| Модуль               | Назначение                                                                                                                                                                                                                             | Public API         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `src/entities/game`  | формат уровня и его валидация, движок доски `BoardEngine`, чистые правила доски (очки, звёзды, «?», механики), бот-солвер, виды бустеров                                                                                               | `@/entities/game`  |
| `src/entities/level` | паки уровней JSON (`packs/<id>`, пак `main` из 30), файл пака, шкала сложности `LEVEL_DIFFICULTY_WIN_RATE`, `DEFAULT_LEVEL_BOOSTERS`                                                                                                   | `@/entities/level` |
| `src/entities/skin`  | скин и описание элементов: подписи, иконки, текстуры (файлы `?url` и процедурное рисование), виды клеток (`sprite`/`frames`/`spine`), цвета холста, шрифт, звуки; реестр `getElementLabel`/`getElementIcon`/... ([skin.md](./skin.md)) | `@/entities/skin`  |

## Shared

| Модуль                      | Назначение                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/shared/constants`      | routes and shared constants                                                                              |
| `src/shared/lib/assets`     | public-asset path helper (`import.meta.env.BASE_URL`), прогрев картинок, арт победы                      |
| `src/shared/lib/assetCache` | сессионный blob-стор статики (прогрев арта победы)                                                       |
| `src/assets`                | SVGR React SVG icons imported with `*.svg?react`                                                         |
| `src/shared/lib/format`     | `pluralizeRu`, `formatScore`, `formatMoves`/`movesWord`                                                  |
| `src/shared/lib/motion`     | motion tokens                                                                                            |
| `src/shared/lib/routing`    | route helpers: query-preserving links, `?level`/`?gameDebug`/`?insets`/`?seed`/`?perf`/`?renderer` flags |
| `src/shared/lib/random`     | зерно партии: `createSeededRandom`, `normalizeSeed`, `createRandomSeed` для движка                       |
| `src/shared/lib/storage`    | `resolveStorage` - `localStorage` окна или `null`, если его нет или он запрещён                          |
| `src/shared/modals`         | modal primitive, portal/provider and `motion/react` layout                                               |
| `src/shared/styles`         | global SCSS primitives                                                                                   |
| `src/shared/testing`        | test setup                                                                                               |
| `src/shared/ui`             | reusable UI atoms/components                                                                             |

## Public Assets

Статичные URL-файлы живут в `public/` по подпапкам типа: `images/`, `fonts/` (без `icons/` - иконки только в `src/assets`). Ссылки из JS/TSX идут через `src/shared/lib/assets` (`publicAsset`, `import.meta.env.BASE_URL`), из CSS - абсолютные `/...` пути (как `/fonts/...`). SVG-иконки, которые нужны как React-компоненты, живут в `src/assets` и импортируются через `*.svg?react`. Сейчас: `public/fonts/Nunito-{Regular,Bold,SemiBold,ExtraBold,Black}.woff2`, `public/dl-games.png` (favicon). Игровые текстуры и иконки элементов в `public/` не лежат: это папка скина `src/entities/skin/skins/<name>/` (`images/`, `icons/`, `art/`, Vite-импорт `?url`; см. [skin.md](./skin.md) и [game-flow.md](./game-flow.md#откуда-берутся-игровые-текстуры)); арт победы - `src/assets/icons/game/trophy.svg`.

## Current UI Primitives

- `modalButton`;
- `spinner`.

## Modal Primitives

- `src/shared/modals/ui` (`Modal`) - centered/fullscreen modal primitive for
  cross-route overlays.

## Not Active Yet

The repo currently does not contain shop, rewards, lives/coins, backend transport or debug console. Level progress lives in the host (`localStorage`), mechanic tutorial - thin widget contract (`tutorial`/`onTutorialSeen`).
