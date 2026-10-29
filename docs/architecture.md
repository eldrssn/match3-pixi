# Architecture

`match3-pixi` - порт Phaser-шаблона Match-3 на Pixi v8 + GSAP 3 (+ Spine, если
его просит скин); история переноса и соответствие модулей - в
[PLAN.md](./PLAN.md). Ниже - текущее устройство.

## Архитектурные Слои

Текущий проект использует Vite + React Router и практичный FSD layout
(импорт только вниз: `app → pages → widgets → features → entities → shared`,
границы держит ESLint, блок `layerBoundaries` в `eslint.config.js`):

- `src/app` - application composition, routing, viewport height hook.
- `src/pages` - route-level pages; главная - пример хоста Match-3 виджета,
  `pages/minimalHost` - самый короткий хост без маршрута (образец, под
  type-check).
- `src/widgets` - Match-3 виджет (`widgets/game`, рантайм партии на Pixi),
  модалки примера хоста, конструктор уровней.
- `src/features` - `features/match3Host`: чистые правила хоста партии
  (прогресс по паку, выбор уровня, бустеры, «+ходы», подсказки механик) - то,
  что переживает замену главной своим хостом (см.
  [custom-host.md](./custom-host.md)).
- `src/entities` - формат уровня, чистые правила доски, каталог уровней,
  скин и описание элементов (`entities/skin`).
- `src/shared` - reusable UI, modal primitive, styles, routing/asset/format
  libs.

## Инициализация Приложения

### 1. Entry

[src/main.tsx](../src/main.tsx):

- подключает `src/app/styles/index.scss`;
- монтирует `<App />` в `React.StrictMode`.

### 2. App Shell

[src/app/App.tsx](../src/app/App.tsx) собирает:

- `BrowserRouter`;
- каркас `.root` (`App.module.scss`) на всю видимую высоту окна;
- `ModalsProvider`;
- `AppRoutes`.

App-level hooks: `useViewportHeight()` - единственный владелец
`--app-viewport-height` (`window.innerHeight`), и `useIOSGestureHack()` -
запрет pinch-zoom. Шаблон - обычная страница: моста в нативное приложение,
safe-area runtime, десктопной рамки, экрана «поверните устройство»,
ErrorBoundary и debug-консоли нет. Ширину содержимого на десктопе
ограничивает колонка `app-frame` внутри страницы (см.
[responsive-layout.md](./responsive-layout.md)).

### 3. Routing

[src/app/routing/Routes.tsx](../src/app/routing/Routes.tsx) - два маршрута:
главная `/` (eager) и редактор `/editor` (отдельный lazy-чанк, и только в
сборке с флагом `VITE_ENABLE_EDITOR` - константа `__EDITOR_ENABLED__`; без
неё чанка редактора в бандле нет). Неизвестный путь уводит на `/` с сохранением
query/hash (`RedirectToMain`). Общего экрана загрузки и preload gate нет.

Локальные спиннеры остаются у запуска партии, ленивого чанка редактора и
игрового превью. Ассеты игры греются при старте партии.

### 4. Session asset cache

[src/shared/lib/assetCache](../src/shared/lib/assetCache) хранит прогретые
URL-ассеты в сессионном blob-сторе. Сейчас им прогревается арт карточки победы
(`warmPartyAssets`) на старте партии.

## Current Screens

- `Main` - главная `/` и хост партии: заголовок и кнопки «Играть · уровень
  N»/«Уровни»/«Витрина»/«Редактор» (`pages/main/ui/MainActions`), карта уровней
  (`ui/LevelMap`, режим `map`), витрина механик (`ui/ShowcaseList`, режим
  `showcase`), а во время партии - `GameScreenLazy` вместо
  них. Сценарий - `pages/main/model/useMainFlowStore`, правила выбора уровня
  и бустеров - `features/match3Host/model/partyRules`, прогресс в
  `localStorage` - `features/match3Host/model/levelProgress` (см.
  [game-flow.md](./game-flow.md)). Главная - пример: виджет и редактор от неё
  не зависят, своя замена описана в [custom-host.md](./custom-host.md).
- `EditorPage` - full-width dev-конструктор уровней.

## Match-3 Виджет

`widgets/game` - партия как компонент: `GameScreenLazy` получает `level`,
`boosters`, `preBoosters`, `tutorial`, `paused`, `debug`, `insets`, `seed`,
`quality`, `renderer`, `title` и отдаёт `onFinish({ isVictory, score, stars })`/`onOutOfMoves`/
`onTutorialSeen`/`onExitRequest`/`onError`/`onBoardEvent` (`IGameScreenProps`;
события партии `TBoardEvent` - из протокола шагов и `GameStore`). `GameScreen` - разметка, рантаймом владеет хук
`model/useGameRuntime`, очередью подсказок механик - `model/useMechanicTips`.
Правила доски - чистый движок `BoardEngine` (`entities/game/engine`: фасад и
модули правил над общим состоянием доски): его шаги проигрывает
`modules/BoardStepPlayer` по реестру анимаций шагов `modules/steps` (он же
засчитывает цели тем же правилом, что бот - `listGoalEvents`), а `GameLogic` оркеструет ход - ввод, занятость доски, заряд
бустера, исход; буфер ввода под каскадом и выбор первого тапа - модули
`PendingBoardInput` и `SelectionMarker` (см.
[game-flow.md](./game-flow.md#движок-доски)). Баррель `@/widgets/game` свободен от
Pixi, GSAP и Spine; рантайм приезжает ленивым чанком `GameScreen`; превью
редактора - тот же `GameScreenLazy`, хост которого редактор.
Живой рантайм в приложении один (`GameStore`, `renderScale`, `sceneInsets` -
синглтоны; новый `bootGameRuntime` при живом прошлом пишет `console.warn` и
гасит его), поэтому хост монтирует не больше одного экрана партии. Отступы под
вырез хост передаёт пропом `insets` или переменными `--match3-inset-*`; сцена
раскладывается по безопасной зоне одним правилом `lib/sceneLayout`.

## Рантайм Партии

Рантайм - `Application` Pixi без сцен: ядро, слои-контейнеры и модули,
которые получают ядро конструктором (глобала ядра нет). Жизненный цикл
подробно - [game-flow.md](./game-flow.md#жизненный-цикл-рантайма). Пути - от
`src/widgets/game/`.

| Модуль                                             | Что делает                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/bootGameRuntime`                              | единственное место, где создаются `Application` и ядро: параллельно `Application.init` (рендерер по `configs/renderer`, прозрачный фон, `resolution` = `getRenderDpr()` + `autoDensity`), файлы скина, шрифт и скелеты Spine; затем процедурные текстуры, ядро и модули; первый отрисованный кадр снимает `isGameLoaded`. Отдаёт `IGameRuntime` (`setPaused`, `setInputEnabled`, `resize`, `destroy`) |
| `core/GameRuntimeCore`                             | ядро одной партии: `app`, `layers`, `motion`, `events`, `textures`, `input`, `spine`, реестр модулей (`registerModule`: только для уничтожения, модули друг друга из него не достают), `resize` (`renderer.resize` под CSS-размер и DPR, событие `resize` с раскладкой сцены), `destroy` с изоляцией сбоя каждого модуля                                                                                                                                |
| `core/RuntimeLayers`                               | пять слоёв-контейнеров под `app.stage` в порядке отрисовки: `Background`, `GameBoard`, `TopMenu`, `TopMenuCenter`, `BottomMenu`; глубина внутри - `zIndex` + `sortableChildren` (числа `configs/sceneDepths`)                                                                                                                                                                                         |
| `core/RuntimeEvents`                               | своя типизированная шина рантайма (`IRuntimeEventMap`: `resize`, `pause`/`resume`, свап и жесты клеток, бустеры, события доски)                                                                                                                                                                                                                                                                       |
| `core/RuntimeInput`                                | замок ввода: `stage.eventMode` `static`/`none`, хуки сброса незавершённого жеста (`addResetHook`)                                                                                                                                                                                                                                                                                                     |
| `core/destroyApplication`                          | уничтожение сцены до рендерера, очистка `TexturePool`, `GlobalResourceRegistry.release()`                                                                                                                                                                                                                                                                                                             |
| `motion/RuntimeMotion`                             | часы рантайма на тикере Pixi: корневой таймлайн GSAP (`tween` промисом, `add`, `delay`, `schedule`, `killTweensOf`), `setTimeScale`, `pause`/`resume`, покадровые подписчики `onFrame` (`timeScale: 'follow'` или `'ignore'`); ease-имена - `motion/easeNames`                                                                                                                                        |
| `textures/*`                                       | `TextureRegistry` (текстуры и кадры листов по ключу скина), `loadSkinTextures` (файлы через `Assets`), `registerProceduralTextures` (холсты скина) - см. [skin.md](./skin.md#текстуры)                                                                                                                                                                                                                |
| `modules/GameLogic`                                | оркестратор хода: ввод, занятость доски, бустеры (`BoosterMode`), подсказка простоя (`IdleHint`), дыхание фишек (`IdleBreathing`), финал                                                                                                                                                                                                                                                              |
| `modules/BoardStepPlayer`, `modules/steps`         | проигрыватель шагов `BoardEngine` по реестру `DEFAULT_STEP_ANIMATIONS` + `stepAnimationOverrides.ts`                                                                                                                                                                                                                                                                                                  |
| `modules/cells/*`                                  | сущности клеток (`BoardEntity` и наследники, `LayerEntity`), `BOARD_VIEWS`, `CellMover`, `CellInputController`, виды клеток `views/*` (`CELL_VIEW_KINDS`: `sprite`, `frames`, `spine`)                                                                                                                                                                                                                |
| `fx/*`                                             | эффекты доски по контракту `IBoardFx` (`fx/boardFx`): `createBoardFx`, частицы `ParticleLayer` на `ParticleContainer`, `specialFx`, `boosterFx`, учёт объектов и твинов `FxScene`; тряска и вспышка - корень сцены                                                                                                                                                                                    |
| `hud/*`                                            | контракт шапки для доски `IBoardHud` (`hud/boardHud`), реализация `createBoardHud` поверх `GameGoalsPannel` и `MovesCounter`; остальная шапка - модули `ScoreMeter`, `BoostersContainer`, `boosters/BoosterButton`, `ExitButton`, `SoundToggle`                                                                                                                                                       |
| `spine/*`                                          | `spineSupport` (контракт `ISpineSupport`/`ISpineActor`, `loadSpineSupport`) и `spineRuntime` (единственный импорт `@esotericsoftware/spine-pixi-v8`, только динамический) - см. [skin.md](./skin.md#анимации-доски-и-темп)                                                                                                                                                                            |
| `modules/PerfMonitor`                              | FPS на тикере, понижение качества по чистому `lib/perfGovernor`                                                                                                                                                                                                                                                                                                                                       |
| `audio/SoundEngine`                                | синтез рецептов звука на своём `AudioContext` партии (создаётся первым жестом, закрывается на `destroy`), пауза по шине                                                                                                                                                                                                                                                                               |
| `lib/watchRendererContext`, `lib/contextLossGuard` | потеря контекста: WebGL - события канваса, WebGPU - `device.lost`; без восстановления за 15 с - отказ `context-lost`                                                                                                                                                                                                                                                                                  |

### Рендерер: WebGPU и WebGL

`configs/renderer` переводит проп `renderer` (`TRendererMode`: `auto`,
`webgpu`, `webgl`) в `preference` для `Application.init`: `auto` и `webgpu` -
WebGPU с откатом Pixi на WebGL, `webgl` - WebGL. Шаблонная главная читает
QA-флаг `?renderer=webgl|webgpu` (`shared/lib/routing/readQueryRenderer`).
Фактический рендерер пишется в `GameStore.rendererKind` и виден в отладочной
панели (`?gameDebug=true`). Init без единого рендерера - отказ `context-lost`.

### Чанки И Бюджет Бандла

`vite.config.ts` (`manualChunks`) раскладывает движок по ленивым чанкам:
`pixi` (Pixi и его зависимости), `gsap`, `spine` (пакеты
`@esotericsoftware`); обвязка `spine/spineRuntime` - свой маленький чанк
`spineRuntime`, он импортируется только динамически и только для скина с
видом клетки `spine`. `pixi` и `gsap` приезжают вместе с чанком `GameScreen`
на первом «Играть»; стартовый чанк (`index` + `vendor`) их не содержит.

Это держат два сторожа:

- `widgets/game/barrelPixiFree.test.ts` обходит статический граф импортов
  барреля `@/widgets/game` и запрещает `pixi.js`, `gsap`, `@esotericsoftware/*`
  (и `phaser`); второй тест - экран партии статически не тянет Spine;
- `npm run bundle:check` (`scripts/bundleCheck.ts`, после `build`, CI-задача
  `bundle`) читает `dist/`: стартовый чанк без `pixi`/`gsap`/`spine` и
  бюджеты (КБ raw/gzip) - старт 500/155, `GameScreen` 165/52, `pixi` 645/188,
  `gsap` 75/30, `spine` 228/68 и `spineRuntime` 4/2 (оба необязательные).

## Скин И Описание Элементов

`src/entities/skin` - как элемент выглядит и называется: запись на каждый код
формата (подпись, иконка DOM, текстуры покоя и стадий, цвет частиц, звук
удара, карточка редактора, подсказка механики) и оформление партии
(текстуры-файлы и процедурное рисование, цвета холста, шрифт текстов холста,
переопределения звуков). Папка активного скина - `skins/default/`, выбор -
`model/activeSkin.ts`. Читают его DOM (редактор, модалки, подсказки механик)
и рантайм партии; `entities/game` его не импортирует. Вид на доске
(класс сущности рантайма) - вторая половина описания, реестр
`widgets/game/modules/cells/boardViews.ts`; способ рисования клетки (спрайт,
кадры, Spine) скин выбирает полем `board.view`, фабрику - реестр `CELL_VIEW_KINDS`.
Темп доски скин переопределяет частично (`timing`). Скин - ленивый чанк, в стартовый
граф не входит. Подробно - [skin.md](./skin.md).

## Modal System

[src/shared/modals](../src/shared/modals) содержит generic primitive: portal,
layout, `motion/react` animations, focus trap и z-index allocation.
[src/widgets/modals](../src/widgets/modals) содержит прикладной слой: реестр
(`levelStart`/`outOfMoves`/`victory`/`defeat`), typed props, Zustand store и
content views. `App`
монтирует `ModalsProvider` внутри каркаса и внутри `BrowserRouter`, поэтому
модалки живут поверх текущего route, берут общую высоту окна
(`--app-viewport-height`) и закрываются при смене маршрута.

Подробный contract добавления новых модалок описан в [modals.md](./modals.md).

## Boundaries

- Route-specific composition lives in `src/pages` or `src/app/routing`.
- Reusable widget composition lives in `src/widgets`.
- Pure party-host rules reused by any host (the example main page, the editor
  preview, a project's own host) live in `src/features/match3Host`.
- The example host (`src/pages/main`, product modals `src/widgets/modals`) is
  never imported from `widgets/game`, `widgets/levelConfigEditor`, `features`,
  `entities` or `shared`: a project copy deletes it as a whole.
- Level format/board rules and the board engine (`BoardEngine`) live in
  `src/entities/game`, level catalog - in `src/entities/level`.
- How an element looks and is named (labels, icons, textures, tints, tips,
  editor cards) and the party skin live in `src/entities/skin`;
  `src/entities/game` never imports it.
- Shared infrastructure lives in `src/shared`.
- `pixi.js`, `gsap` and `@esotericsoftware/*` are imported only inside the
  lazy party runtime (`widgets/game` behind `GameScreen`, Spine - only via
  dynamic import); the barrel `@/widgets/game` stays free of them
  (`barrelPixiFree.test.ts`), the start chunk too (`npm run bundle:check`).

Do not document or implement shop, backend transport or tutorial seams as
active runtime unless they are actually added to this repo.

## Что Обновлять При Изменениях

- route map;
- app shell;
- module boundaries;
- public exports;
- runtime module map and chunks (`manualChunks`, бюджеты `bundle:check`);
- viewport/insets contract;
- modal registry/store/views.
