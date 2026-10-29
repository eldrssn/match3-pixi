# match3-pixi - Match-3 Template на Pixi (no backend)

## История

`match3-pixi` - порт Phaser-шаблона Match-3 на Pixi v8 + GSAP 3 + Spine с
тем же функционалом; перенос завершён (фазы 0-6), план, инварианты, журнал
фаз и отклонения от исходника - [docs/PLAN.md](./docs/PLAN.md). Phaser в
проекте нет совсем; в комментариях кода «эталон» - исходный Phaser-шаблон,
по которому сверялись числа и хореография.

## Рантайм Партии (Pixi)

Коротко, подробно - [docs/game-flow.md](./docs/game-flow.md#жизненный-цикл-рантайма)
и [docs/architecture.md](./docs/architecture.md#рантайм-партии):

- Запуск - `widgets/game/lib/bootGameRuntime`: `Application.init` с
  предпочтением рендерера (`configs/renderer`: `auto`/`webgpu` - WebGPU с
  откатом на WebGL, `webgl`; проп `renderer`, QA-флаг `?renderer=webgl|webgpu`,
  фактический - `GameStore.rendererKind`), `resolution` = DPR рендера +
  `autoDensity`; параллельно - текстуры скина, шрифт (`lib/waitGameFonts`) и,
  если в скине есть вид `spine`, скелеты. Живой рантайм один: второй запуск
  гасит прошлый с `console.warn`. Первый отрисованный кадр -> `isGameLoaded`.
- Ядро - `core/GameRuntimeCore` передаётся модулям явно (глобала нет): слои
  `core/RuntimeLayers` (`zIndex` + `sortableChildren`, числа `sceneDepths`),
  типизированная шина `core/RuntimeEvents`, замок ввода `core/RuntimeInput`
  (`stage.eventMode` + хуки сброса жеста), часы, реестр текстур, ресайз
  (`renderer.resize(css, dpr)`). Уничтожение - `core/destroyApplication`
  (сцена до рендерера, затем глобальные ресурсы Pixi). Потеря контекста:
  WebGL - события канваса, WebGPU - `device.lost`; 15 с без восстановления ->
  `onError('context-lost')`.
- Время - `motion/RuntimeMotion`: GSAP-твины в одном корневом таймлайне,
  который двигает тикер Pixi (пауза и темп доски общие), `tween` - промис,
  `delay`/`schedule`, покадровые `onFrame(cb, { timeScale: 'follow' | 'ignore' })`
  (частицы, тряска и вспышка - `ignore`, скелеты Spine - `follow`); кривые -
  `motion/easeNames`.
- Текстуры - `textures/*`: файлы скина через `Assets.load` (без воркеров, без
  `createImageBitmap` на загрузке, `crossOrigin: 'anonymous'` - общий кэш с
  `warmGameAssets`), потом `ImageBitmap` для WebGPU; процедурные холсты скина -
  `registerProceduralTextures`, кэш на приложение; спрайт-листы - `sheetFrames`.
  Битый файл -> `onError('assets')`.
- Доска - `modules/GameLogic` (оркестратор хода), `modules/BoardStepPlayer` +
  реестр анимаций шагов `modules/steps`, сущности и виды клеток
  `modules/cells` (`BOARD_VIEWS`, `CELL_VIEW_KINDS`: `sprite`, `frames`,
  `spine`), ввод `CellInputController` (зона `hitArea`, слежение и отпускание -
  на корне сцены), `BoosterMode`, `PendingBoardInput`.
- Шапка на холсте - `hud/createBoardHud` (`IBoardHud`) поверх
  `GameGoalsPannel`/`GoalIntro`, `MovesCounter`, `ScoreMeter`,
  `BoostersContainer`/`boosters/BoosterButton`, `ExitButton`, `SoundToggle`;
  тексты холста - `lib/runtimeText`.
- Эффекты - `fx/createBoardFx` (`IBoardFx`): частицы на `ParticleContainer`
  (`fx/ParticleLayer`, физика - `lib/particleMotion`), тряска и вспышка корня
  сцены, `fx/specialFx`, `fx/boosterFx`, полёт копии к цели; числа -
  `lib/boardFxRules`.
- Spine - ленивые чанки `spine` (пакеты) и `spineRuntime` (обвязка):
  качаются, только если в активном скине есть вид клетки `spine`
  (`spine/spineSupport`, `SpineCellView`). Spine Runtimes требуют лицензии
  Spine Editor (README).
- Бюджет бандла - `npm run bundle:check` (`scripts/bundleCheck.ts`, CI-задача
  `bundle`): стартовый чанк без Pixi, GSAP и Spine, размеры `GameScreen`,
  `pixi`, `gsap`, `spine`, `spineRuntime`.
- Известные ограничения (кэш bind group-ов WebGPU-батчера Pixi растёт за
  сессию и т.д.) - [docs/game-flow.md](./docs/game-flow.md#известные-ограничения).

## graphify - читать граф в первую очередь

**Это правило важнее всего остального в файле.** У проекта есть knowledge graph
(`graphify-out/graph.json`, в `.gitignore`) с god nodes, структурой community и
cross-file связями - строится командой `graphify update .`. Хуков graphify в
`.husky/` нет (их скрипты, которые пишет `graphify hook install`, содержат путь
к Python конкретной машины): граф собирается вручную, а кто хочет авто-обновление
post-commit/post-checkout, ставит хуки у себя командой `graphify hook install`
из корня репозитория (при Husky она пишет в `.husky/`, такие файлы не коммитим).

Экономичный рабочий протокол:

1. Перед любым вопросом о коде, архитектуре, связях модулей или поиске владельца поведения сначала запусти `graphify query "<question>" --budget 1200`, если `graphify-out/graph.json` существует.
2. Для связи между двумя сущностями используй `graphify path "<A>" "<B>"`; для точечного объяснения - `graphify explain "<concept>"`.
3. После ответа графа читай только файлы и строки, которые граф вернул как `src=... loc=...`.
4. Не начинай с широкого `rg`, `find`, чтения `src/`, `docs/` или `graphify-out/GRAPH_REPORT.md`, пока не попробован `graphify query`/`path`/`explain`.
5. Если граф дал шумный или неполный ответ, сузь вопрос и повтори с небольшим budget; к raw search переходи только после этого.
6. `graphify-out/GRAPH_REPORT.md` открывай только для широкого архитектурного обзора или когда `query`/`path`/`explain` не дали достаточного контекста.
7. Если `graphify-out/wiki/index.md` существует, используй wiki для broad navigation вместо сырого обхода файлов.
8. После изменения кода запусти `graphify update .`, чтобы держать граф актуальным (AST-only, без LLM/API cost).

Это правило действует и на подзадачи: если ты ставишь codebase-задачу
subagent'у (Task/Agent tool), включай в его промпт то же требование -
`graphify query`/`explain`/`path` до чтения сырых файлов.

## Что Это За Проект

`match3-pixi` - Vite + React шаблон игры Match-3 без бэкенда, обычная
веб-страница: главная с кнопками «Играть», «Уровни», «Витрина» и «Редактор», карта
уровней, партия на Pixi, карточки уровня, near-miss и победы/поражения,
конструктор паков уровней с проверкой ботом (только в сборке с флагом
`VITE_ENABLE_EDITOR`). Ни транспорта, ни авторизации, ни
внешних SDK, ни отправки данных, ни моста в нативное приложение. Партия -
переиспользуемый виджет `widgets/game`; встраивание в чужое приложение
(отступы под вырез и т.д.) - забота хоста.

Это не Next.js проект. В текущем runtime нет Redux, RTK Query, TanStack Query,
Axios, OpenAPI generation, Phaser, game-core, tutorial flows и backend-доменов.
Документация должна описывать только активные seams этого репозитория.

## Технологический Стек

- Vite + React 19 + TypeScript strict
- React Router
- Zustand для session/layout state
- SCSS Modules + shared SCSS primitives
- Vitest + React Testing Library (`renderHook` для хуков) для unit-тестов
- рантайм партии: Pixi v8 (`pixi.js`), твины - GSAP 3 (`gsap`), Spine -
  `@esotericsoftware/spine-pixi-v8` (ленивыми чанками, см. «Рантайм Партии»)

## Основные Команды

| Команда                 | Назначение                                                                   |
| ----------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`           | локальная разработка                                                         |
| `npm run build`         | type-check build + Vite production build                                     |
| `npm run preview`       | локальный preview `dist`                                                     |
| `npm run lint`          | ESLint                                                                       |
| `npm run lint:fix`      | ESLint auto-fix                                                              |
| `npm run format`        | Prettier auto-format `src/**/*.{ts,tsx}`                                     |
| `npm run format:check`  | Prettier check (входит в `prebuild`)                                         |
| `npm run type-check`    | TypeScript no-emit check                                                     |
| `npm test`              | Vitest, проект `unit` (watch): без медленных тестов                          |
| `npm run test:slow`     | проект `slow`: бот-проверка каталога и перф-гейт движка                      |
| `npm run test:ci`       | оба проекта одним прогоном - CI-задача `test`, гейт выкладок                 |
| `npm run test:coverage` | coverage                                                                     |
| `npm run bundle:check`  | после `build`: бюджет чанков и ленивость движка (`scripts/bundleCheck.ts`)   |
| `npm run levels:report` | сводка сложности паков ботом-солвером (`PACK=id` - один пак)                 |
| `npm run levels:import` | `<file>`: файл пака из редактора -> `entities/level/packs/<id>` + отчёт бота |

## Build-Time Env

Локально Vite читает стандартные `.env*` (пример - `.env.example`). В CI
значения `VITE_*` приходят из GitLab Project Variable `BUILDS_ENV` типа File:
внешний `devops/ci-cd/templates` материализует её в `builds_file.env`, а
`BUILDS_ENV_STRING` - в `builds_string.env`. Чтение живёт в
[config/buildEnv.ts](./config/buildEnv.ts): CI-файлы накладываются поверх
обычного `loadEnv`, `builds_string.env` перекрывает `builds_file.env`, `$VAR`
внутри файлов не интерполируется кодом приложения, а `vite build` печатает
summary источников. Production build валидирует только `VITE_APP_ENV`;
`VITE_CDN_BASE_URL` - опциональный. `VITE_ENABLE_EDITOR` (`true`/`false`) -
есть ли в сборке редактор уровней (`/editor` и кнопка «Редактор»): по
умолчанию включён в dev-сервере и тестах, выключен в `vite build`; стейдж
геймдизайнера собирается с `true`. `vite.config.ts` подставляет его
константой `__EDITOR_ENABLED__` (`define`, тип - `src/vite-env.d.ts`), и без
флага чанк редактора в бандл не попадает вовсе.

## Git-Хуки И CI

- Husky: `prepare` = `husky` (ставится на `npm install`/`npm ci`), хук
  `.husky/pre-commit` - `npx lint-staged` (Prettier + ESLint по staged-файлам,
  конфиг - `lint-staged` в `package.json`). Husky включается, только когда
  папка проекта - корень git (`.git` рядом с `package.json`); иначе `prepare`
  печатает «.git can't be found» и ничего не меняет. Хуков graphify нет (см.
  выше).
- `.gitlab-ci.yml` (общие задачи из внешнего `devops/ci-cd/templates`):
  `test` (`npm run test:ci`, с ботом-солвером) и `bundle` (`npm run build` +
  `npm run bundle:check`, `VITE_APP_ENV=production`) - гейты выкладок
  `deploy-tst` и `start-review`; образ собирает kaniko по `Dockerfile`
  (`npm run build` с type-check, lint и format в `prebuild`).

## Runtime Shell

- [src/main.tsx](./src/main.tsx) только монтирует React.
- [src/app/App.tsx](./src/app/App.tsx) собирает `BrowserRouter`, каркас
  `.root` на всю видимую высоту окна, `ModalsProvider` и `AppRoutes`, плюс
  `useViewportHeight()` (единственный владелец `--app-viewport-height`) и
  `useIOSGestureHack()` (запрет pinch-zoom). ErrorBoundary, debug-консоли,
  safe-area runtime, десктопной рамки и экрана «поверните устройство» нет.
- [src/app/routing/Routes.tsx](./src/app/routing/Routes.tsx) описывает
  маршруты: `/` eager, `/editor` - lazy-чанк, только при `__EDITOR_ENABLED__`.
- [src/shared/modals](./src/shared/modals) владеет generic modal
  primitive/host, [src/widgets/modals](./src/widgets/modals) - registry/store
  и content modal views.

## Routing

Маршруты описаны прямо в `src/app/routing/Routes.tsx`, пути - в
`src/shared/constants/model/routes.ts` (`ROUTES`). Новый маршрут добавляется
туда же. Текущие routes:

| Route     | Файл                                                               | Назначение                                                       |
| --------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `/`       | `src/pages/main/Main.tsx`                                          | главная, карта уровней, партия                                   |
| `/editor` | `src/pages/editor/EditorPage.tsx`, `src/widgets/levelConfigEditor` | full-width конструктор паков уровней (флаг `VITE_ENABLE_EDITOR`) |
| `*`       | `src/app/routing/Routes.tsx` (`RedirectToMain`)                    | fallback на `/` с сохранением query                              |

Редактор работает с паком целиком: шапка (сводка, ошибки, «Сбросить
уровень»/«Применить»), колонка настроек - пак (`ui/LevelConfigPackSection`:
выбор, новый пак, id и название, «Экспорт»/«Импорт…» файлом пака, откат
черновика), список уровней пака (`ui/LevelConfigLevelList`: открыть, добавить,
дублировать, ↑/↓, удалить; номер уровня - позиция) и настройки уровня
(название, ходы, поле, цвета, цели, звёзды, бот, JSON; бот -
`key` по паку и уровню, устаревшие пороги не применяются); id пака
применяется по blur/Enter и обязан пройти `isLevelPackId`. Правки пишутся в
черновик пака в `localStorage` через ~300 мс после последней, сразу - на
`pagehide` и уходе из редактора (`model/useEditorWorkspace` поверх чистого
`model/editorWorkspace`; рядом `model/useLevelJson`, `model/useEditorToast`,
собирает их `useLevelConfigEditor`;
ключ `match3-pixi:editor-workspace:v1`). Дальше колонки
рабочего места (палитра по группам «Фишки»/«Хэлперы»/«Блокеры»/«Инструменты»,
карточка элемента, поле, под ним настройки превью `ui/LevelConfigPreviewControls`)
и превью - обычный `GameScreenLazy`, хост которого редактор (`ui/LevelConfigPreview`,
сессия - `model/usePreviewSession` у `LevelConfigEditor`, её делят настройки и
партия, `model/previewOptions`: бустеры,
предуровневые бустеры, подсказки механик, зерно, «+5 ходов» по
`resolveContinueOffer` своей плашкой `ui/LevelConfigPreviewContinue`, а не
модалкой `outOfMoves`: редактор не зависит от примера хоста; новая партия - новый `key`, монтируется следующей задачей после
размонтирования старой; невалидный уровень - пустое состояние «примените»,
партия не монтируется). Ширину боковых колонок на десктопе тянут
разделители (`ui/LevelConfigColumnSplitter`, двойной клик - по умолчанию,
ширины помнит `localStorage`, `model/editorColumns`), поле берёт остаток. Элемент ставится кликом, кистью и
перетаскиванием, ПКМ стирает, `Ctrl+Z` откатывает; «Перегенерировать фишки»
не трогает расставленные блокеры. Подробности - [docs/levels.md](./docs/levels.md#редактор-и-как-добавить-уровень).

Главная открывается сразу без AppLoader. `/editor` остаётся
full-width: колонку контента (`app-frame`) он не использует. Query-строка
сохраняется при переходе в редактор и wildcard fallback. Игровые ассеты
готовятся при старте партии.

## Главная

Главная `/` — однотонный фон `--bg-main` и четыре обычные кнопки: «Играть ·
уровень N» открывает карточку открытого уровня, «Уровни» - карту уровней
(режим главной `map`, `pages/main/ui/LevelMap`), «Витрина» - список уровней
по механикам (режим `showcase`, `pages/main/ui/ShowcaseList`), «Редактор» -
`/editor` (только при `__EDITOR_ENABLED__`).
Кнопки живут в `pages/main/ui/MainActions`. Во время партии вместо них монтируется экран
партии, фон - `--bg-game` (тот же цвет у превью редактора); фоновых
изображений и анимаций смены главная ↔ партия нет.

## Геймфлоу

Партия - Match-3 виджет `widgets/game`: `GameScreenLazy` получает `level`,
`boosters`, `preBoosters`, `tutorial`, `paused`, `debug`, `insets`, `seed`,
`quality`, `renderer` (`TRendererMode`: `auto`/`webgpu`/`webgl`), `title`
(подпись под доской, без неё - «Уровень N») и отдаёт
`onFinish({ isVictory, score, stars })`, `onOutOfMoves(offer)`, `onTutorialSeen(mechanic)`, `onExitRequest()`,
`onError(reason)` и необязательный `onBoardEvent(event)` (`IGameScreenProps`).
События партии `TBoardEvent` (баррель `@/widgets/game`): `moveMade`, `cascade`,
`specialCreated`, `goalProgress`, `goalCompleted`, `boosterUsed`,
`scoreChanged` - выводятся чистыми `listStepBoardEvents` (шаги протокола) и
`diffStoreBoardEvents` (переходы `GameStore`), а не из спрайтов. Про уровни, модалки, экраны и
прогресс виджет не знает. Одна партия - один маунт: новая партия -
новый `key`, а не смена `level`. Живой рантайм в приложении один (`GameStore`,
`renderScale` - синглтоны), поэтому хост не монтирует два экрана
партии одновременно. `GameScreen` - разметка, рантаймом владеет
`widgets/game/model/useGameRuntime`. Баррель `@/widgets/game` свободен от
Pixi, GSAP и Spine; превью редактора - тот же `GameScreenLazy`, отдельной точки входа
рантайма нет.

Хост в шаблоне - главная, и это **пример**: копия шаблона удаляет
`pages/main` (и при желании `widgets/modals`) или пишет свой хост, а виджет
партии и редактор от неё не зависят. Чистые правила хоста, которые стоит
переиспользовать, - слой `src/features/match3Host` (прогресс по паку,
бустеры, «+ходы», выбор уровня, подсказки механик); самый короткий хост -
`src/pages/minimalHost/MinimalHost.tsx` (без маршрута, но под type-check);
как написать свой и что удалить - [docs/custom-host.md](./docs/custom-host.md).

Главная играет пак `main` (`HOST_LEVEL_PACK =
DEFAULT_LEVEL_PACK`), сценарий целиком в
`pages/main/model/useMainFlowStore` (`screen`: `home`/`map`/`showcase`/`game`/
`result`, `partyId`, `party` - `{ source, level, title?, boosters, preBoosters,
tutorial }`, где `source` - `{ kind: 'pack', levelNumber }` или
`{ kind: 'showcase', key }`
партии, `continuesUsed`, `progress`, `failure`; текущий уровень - не поле, а
селектор `selectCurrentLevel` от прогресса); правила выбора уровня и
бустеров - чистые функции `features/match3Host/model/partyRules`, прогресс -
`features/match3Host/model/levelProgress` (`localStorage`, ключ на пак
`levelProgressStorageKey`: у `main` - `match3-pixi:progress:v1`;
открытый уровень, звёзды, рекорды, знакомые механики). Партия обрывается на размонтировании главной
(`goHome()` в cleanup), а не на её маунте. «Играть» → `play()` (уровень из
`?level=N` в границах каталога, иначе открытый) → карточка уровня
`levelStart` (цели, ходы, лучшие звёзды, предуровневые бустеры) → её «Играть»
→ прогрев ассетов и чанков → `screen: 'game'`, `partyId + 1`. Ходы кончились,
цели нет → `onOutOfMoves` → карточка `outOfMoves` (+5 ходов, один раз за
партию, `resolveContinueOffer`). Исход → `finish(outcome)`: на победе прогресс
(открытый уровень, звёзды и очки) пишется **до** показа карточки, затем
`showModal(victory | defeat, { onPlay, onHome, score, stars })`; «Дальше»
(уровень после сыгранного, после последнего - он же) и «Ещё раз» ведут через
карточку уровня. Переигровка старого уровня с карты текущий уровень не
сдвигает.
Уровень витрины (`playShowcase(key)`) стартует сразу, без карточки уровня,
с `DEFAULT_LEVEL_BOOSTERS` и подсказками всех механик уровня, прогресс не
пишет; «Дальше» на победе - следующий уровень витрины, «Ещё раз» - тот же.
Выход из канваса → `goHome()` без подтверждения. Отказ рантайма →
`fail(reason)`: главная показывает `GAME_RUNTIME_FAILURE_TEXT[reason]`. Пока
карточка результата в DOM, новая партия стоит на паузе
(`paused={useHasMountedModals()}`). Первый уровень идёт без бустеров -
правило хоста (`resolvePartyBoosters` → `[]`), рантайм только прячет пустую
панель (`areBoostersHiddenForParty`). Подробности - в
[docs/game-flow.md](./docs/game-flow.md): ввод, темп доски, интро, текстуры,
жизненный цикл рантайма.

Правила доски - чистый движок `BoardEngine` (`entities/game/engine`, класс -
фасад, правила - модули `boardDamage`/`boardDetonation`/`boardCascade`/
`boardSlime`/`boardMoves` над общим `boardState`), без рантайма и Pixi: свап, каскад с фигурами, спецфишки и их комбинации, урон по слоям,
гравитация с диагональным осыпанием, добор (в клетку, куда не упасть, - на
месте), слизь, бустеры, перемешка тупика,
финальный бонус и предуровневые бустеры разыгрываются синхронно и отдаются
протоколом шагов (`TBoardStep`). Фигуры - чистое правило
`entities/game/lib/boardShapes` (5 > L/T > 4 > 2×2 > 3 дают радугу, бомбу,
ракету, пропеллер); спецфишка срабатывает свапом с любым соседом, одиночным
тапом (это ход, как в Royal Match) и под чужим эффектом - на месте, до
оседания доски. Ход делается свайпом или двумя тапами (`lib/tapSelection`).
Очки - чистое правило по шагам `entities/game/lib/boardScore`, звёзды -
`levelStars` (пороги `starScores` уровня); победа с запасом ходов доигрывает
финальный бонус (`playFinale`: ходы → ракеты).
Шаги проигрывает модуль рантайма `widgets/game/modules/BoardStepPlayer`
(зеркало доски спрайтами) по реестру анимаций `modules/steps`: функция на вид
шага (`DEFAULT_STEP_ANIMATIONS`, запись по всем `TBoardStep['type']`), свои
анимации копии проекта - только `stepAnimationOverrides.ts`
(`(context, step, playDefault)`: дополнить или заменить); клетка - сущность
(`modules/cells/*Entity`: место, `look()`; движение - `CellMover`), вид клетки (`ICellView`,
`cells/views`: `SpriteCellView`, покадровый `FrameCellView`, скелет
`SpineCellView`, выбор - скин
`board.view` и реестр `CELL_VIEW_KINDS`) и ввод (`CellInputController`), выбор цели бустера ведёт
`BoosterMode`, буфер ввода под каскадом - `PendingBoardInput`, выбор первого
тапа - `SelectionMarker`, а `GameLogic` - оркестратор хода: ввод, занятость
доски, заряд бустера (только после `canApplyBooster`), подсказки и финал;
ходы, цели и исход ведёт `GameStore`. Цели уровня проигрыватель шагов
засчитывает тем же правилом, что бот (`listGoalEvents`), а не по `destroy()`
спрайтов. Случайность движка - зерно партии
(проп `seed`, QA-флаг `?seed=N`, `shared/lib/random`), без него случайное.
Подробности - [docs/game-flow.md](./docs/game-flow.md#движок-доски), план
развития до классической Match-3 - [docs/match3-roadmap.md](./docs/match3-roadmap.md).
Звук - синтез WebAudio без аудиофайлов (`widgets/game/audio`: рецепты,
`SoundEngine` на своём `AudioContext`, разблокировка первым жестом; скин переопределяет рецепт по событию -
`resolveSoundRecipe`), кнопка звука - `modules/SoundToggle`,
выключение помнит `localStorage`; см. [docs/game-flow.md](./docs/game-flow.md#звук).

Обучение механике - тонкий контракт: хост передаёт `tutorial` (механики
уровня, которых игрок не видел, `listLevelMechanics`), виджет перед первым
ходом показывает подсказки (`ui/MechanicTip`, текст и иконка - из описания
элемента в скине, `getMechanicTip`; очередь - хук `model/useMechanicTips`) и
зовёт `onTutorialSeen`;
других туториальных мостов нет - доска не знает ни про вырезы, ни про
заблокированный ввод, ни про бесплатные бустеры. Подсказка простоя
показывает лучший ход (`BoardEngine.findBestMove`). Перф-гейт - модуль
`PerfMonitor` + чистое `lib/perfGovernor`: на устойчивой просадке FPS качество
отрисовки (`configs/renderQuality`) один раз понижается (кап DPR 1.5, меньше
украшений); стартовое качество выставляет `setRuntimeLevelConfig`, запись -
одна (`lib/applyRenderQuality`: модуль и зеркало в `GameStore`); QA-флаг
`?perf=low|high`. Исход партии - `{ isVictory, score,
stars }`; бустер описывается одним видом (`TGameBoosterKind`:
`ball`/`laser`/`beam`) и остатком (`IGameStartBooster`), предуровневый -
видом спецфишки (`TPreLevelBoosterKind`: `laser`/`bomb`/`rainbow`).

## Уровни

Каталог - паки уровней (`ILevelPack`: `{ id, title, levels }`), пак - папка
`src/entities/level/packs/<id>/`: `pack.json` (`{ id, title }`) и
`level_<n>_config.json` в формате, который экспортирует редактор; папки
находит `import.meta.glob` (`model/levelCatalog`: `LEVEL_PACKS`,
`DEFAULT_LEVEL_PACK` - пак `main`, `getLevelPack`, `getPackLevel`). Пак одним
файлом (`ILevelPackFile`, `packFormatVersion: 1`) - выгрузка редактора и вход
`npm run levels:import`; разбор и проверка - `lib/levelPackFile`
(`parseLevelPackFile`, `validateLevelPack`). `id` уровня обязан совпадать с
позицией в паке (1..N без дыр) и с номером в имени файла, id пака - с папкой -
проверяет тест. Название (`title`) - необязательное поле самого уровня, его
валидирует `entities/game`; роли в ритме пака (`rhythm`) в формате нет -
поле старых JSON нормализация отбрасывает. Уровень задаёт цвета фишек (`colors`, от двух до шести; без поля -
классические пять `DEFAULT_LEVEL_COLORS`, розовый `pink` только явно), размер поля
(3×3 - 9×9; поле крупнее 6×6 рантайм вписывает в ту же область,
`widgets/game/lib/boardFit`), клетки слоями (накладка `ice`/`chain`, предмет -
фишка, «?» `random`, `cargo`, `stone`, `slime`, `drop`, `HOLE`, подложка
`floor`) и необязательные пороги звёзд `starScores` (без них победа без
звёзд: `stars: null`, редактор - блок «Звёзды за очки»). Прогресс - у хоста в `localStorage`
(`features/match3Host` `levelProgress`). Бустеры - фиксированный `DEFAULT_LEVEL_BOOSTERS` на каждую
партию, инвентарь не копится; предуровневые бустеры выбираются на карточке
уровня. QA-флаг `?level=N` читает хост на каждом «Играть» с главной. Пак `main`

- 30 уровней по кривой «обучение → пик сложности → отдых» (кривая - порядок
  уровней, а не поле JSON); ходы и пороги звёзд подобраны ботом-солвером
  `entities/game/bot` (`greedy`/`casual`/`random`), тест
  `levelCatalog.bot.test.ts` (проект vitest `slow`: `npm run test:slow`, CI -
  `test:ci`, гейт выкладок) не пускает уровень, который `casual` проходит
  реже порога «сложный» (`LEVEL_DIFFICULTY_WIN_RATE`,
  `entities/level/model/levelDifficulty`, все паки), сводка -
  `npm run levels:report`, проверка черновика - секция «Проверка ботом» в
  редакторе (сложность по той же шкале). Формат, пак и бот - в [docs/levels.md](./docs/levels.md).

Витрина - отдельный от пака набор: по уровню на блокер, спецфишку и
комбинацию двух спецфишек (`entities/level/showcase/showcase_<key>_config.json`,
порядок и подписи - `entities/level/model/showcaseCatalog`). Ни бот-проверки
сложности, ни прогресса; тест `showcaseCatalog.test.ts` на нескольких зёрнах проверяет, что
задуманный свап рождает нужную спецфишку или комбинацию. Для витрины формат
клетки умеет спецфишку (`laser` + `direction`, `bomb`, `propeller`, `rainbow`,
`MINIGAME_SPECIAL_IDS`); редактор ставит их из группы «Хэлперы».

## Скин И Описание Элементов

Как элемент выглядит и как называется - слой `src/entities/skin` (баррель
без Pixi и React), папка активного скина - `skins/default/`, выбор - одна
строка `model/activeSkin.ts`. Подробно - [docs/skin.md](./docs/skin.md).

- Описание элемента - запись на каждый код формата (`MINIGAME_ELEMENT_IDS`:
  палитра и спецфишки) в `skins/<name>/elements.ts`: подпись, иконка DOM, вид
  на доске (`board`: текстура покоя, стадии по прочности, цвет частиц, звук
  удара), карточка редактора (группа, описание, `origin`/`area`, оси ракеты) и
  подсказка механики. Полноту держит компилятор (`TSkinElements`).
  Читается только через реестр: `getElementLabel`, `getElementIcon`,
  `getMechanicTip`, `getElementTexture`, `getElementStageTexture`,
  `getElementDestroyTint`, `getElementHitSound`.
- Потребители: палитра, поле и карточка инструмента редактора
  (`editorTools` строит инструменты из реестра), цели (`GoalChips`, редактор),
  карточка уровня (предуровневые бустеры), подсказки механик, рантайм партии
  (текстуры сущностей, панель целей, частицы, звук удара).
- Вид на доске - реестр `widgets/game/modules/cells/boardViews.ts`
  (`BOARD_VIEWS`: код движка -> фабрика сущности, все цвета фишек - вид
  `chip`); `EntityFactory` выбирает по нему. Классы Pixi в `entities` не
  живут, поэтому это вторая половина описания элемента. Способ рисования
  клетки - `board.view` в скине (без поля - спрайт, `frames` - покадровые
  клипы из спрайт-листа: файл с `frameHeight`), фабрика вида - реестр
  `CELL_VIEW_KINDS` (`cells/views/cellViewKinds.ts`); `spine` - скелет Spine
  (`ISkinSpineView`: скелет, атлас, ширина, анимации по крючкам; рантайм -
  ленивый чанк `spine`, только для скина с таким видом; подключение -
  [docs/skin.md](./docs/skin.md#анимации-доски-и-темп)).
- Скин (`ISkinManifest`): текстуры (`files` - Vite `?url` из `images/` с
  шириной, `art` - процедурное рисование `art/*`; файл под ключом холста его
  переопределяет), `cellWidth` (знаменатель `BASE_SCALE`), цвета холста
  (`colors.fx` - эффекты доски, `colors.hud` - холст интерфейса; литералов
  цвета в модулях доски нет), шрифт текстов холста (`fonts.game`;
  `@font-face` - CSS), переопределения звуков по `TSoundCue`, частичное
  переопределение темпа доски (`timing`, глубокое слияние с
  `DEFAULT_BOARD_TIMING` - `lib/mergeBoardTiming`, рантайм читает
  `BOARD_TIMING`).
- Как добавить или переопределить анимацию: темп - `skins/<name>/timing.ts`;
  внешность клетки - `board.view` элемента в скине (или свой `look()` у
  сущности); показ шага хода - `widgets/game/modules/steps/stepAnimationOverrides.ts`
  (позвать `playDefault()` и добавить своё или заменить целиком, держа грид
  через `context.board`). Подробно - [docs/skin.md](./docs/skin.md#анимации-доски-и-темп)
  и [docs/game-flow.md](./docs/game-flow.md#анимации-шагов-хода).
- Новый цвет фишки - код в `MINIGAME_CHIP_IDS` и папка скина; новый
  блокер/спецфишка - правило движка, запись в скине, строка вида в
  `BOARD_VIEWS`, текстура. Чек-листы - в [docs/skin.md](./docs/skin.md).

## Modals

Глобальная modal system описана в [docs/modals.md](./docs/modals.md).
Разделение слоёв жёсткое: `src/shared/modals` - generic-механика (`Modal`,
`ModalsHost`, portal, z-index, focus trap, `inert` для фона) и **не знает** о
конкретных модалках приложения; продуктовый реестр, store и `ModalsProvider`
живут в `src/widgets/modals`.

Клик мимо карточки закрывает модалку - это поведение примитива `Modal`
(`closeOnOverlayClick`, включено по умолчанию; карточки результата его
выключают - выбор действия обязателен). Обработчик
висит на слое `wrap`, а не только на `overlay`: `wrap` растянут поверх
оверлея, поэтому клик до оверлея просто не доходил.

Изменение высоты карточки тоже анимируется примитивом и тоже по умолчанию
(`animateHeight`, `useAnimatedContentHeight` в `shared/modals/lib`): `.content`
следит за собой через `ResizeObserver` и императивно доезжает до новой высоты
через `useAnimate`, а не через `layout` motion - FLIP тянул бы бокс
трансформом и искажал содержимое. На время перехода `overflow` карточки
принудительно `hidden` даже при `contentOverflow="visible"` (`victory`), а
кадры наблюдателя, пришедшие во время перехода, гасятся, но не теряются: по
завершении узел перемеряется и переход доводится до актуальной высоты.
Выключать (`animateHeight={false}`) стоит только там, где высота заведомо
неизменна на всё время жизни карточки; на fullscreen проп игнорируется.
Подробности - в [docs/modals.md](./docs/modals.md).

Новые cross-route модалки добавляются через
`src/widgets/modals/model/modal-registry.ts`, `TModalPropsMap`, загрузчик
чанка в `src/widgets/modals/ui/modalChunks.ts` и lazy view в
`src/widgets/modals/ui/modalViews.tsx` (оба реестра - `Record<TModalKey, …>`:
ключ без загрузчика и вью не скомпилируется). Отдельных `showModalX`/`hideModalX`
экшенов нет - store параметризуется ключом: `useShowModal()`,
`useHideModal()`, `useHideModals()`, `useIsModalShowed(key)`,
`useIsModalMounted(key)` (`true`, пока модалка есть в DOM, включая хвост
exit-анимации).

Слой модалок висит отдельным узлом в `body` на всё окно (затемнение ложится на
весь однотонный фон, карточка через `option` по ширине совпадает с колонкой),
Escape закрывает только верхнюю модалку, фон под открытой модалкой помечен
`inert`. Внутри модалок нельзя использовать
`main`/`h1`.

В реестре четыре модалки: `levelStart` (карточка уровня), `outOfMoves`
(near-miss), `victory` и `defeat` (см.
[docs/modals-catalog.md](./docs/modals-catalog.md)) - все четыре часть
примера хоста (главной): редактор их не открывает, а копия без главной
удаляет `widgets/modals` вместе с `ModalsProvider` в `App.tsx`. Модалок ошибки и
подтверждения выхода нет. Кнопки результата — чистое
`resolveGameResultActions` (победа: «Дальше»/«На главную», поражение: «Ещё
раз»/«На главную»), а что они делают, решает хост: `onPlay`/`onHome` приходят
пропсами модалки (`IGameResultModalProps`, там же `score`/`stars`). Пауза рантайма - проп `paused`
виджета (`IGameRuntime.setPaused` + `setInputEnabled(false)` +
`pointer-events: none` на обёртке доски).

`ExitButton` в канвасе срабатывает по `pointerup` на самой кнопке, уже после
освобождения touch-pointer. `inert` на `#root` канвас партии не глушит:
`EventSystem` Pixi слушает `pointermove` на `document` и `pointerup` на
`globalThis`, куда события приходят и от узла слоя модалок вне `#root`. Ввод
доски под карточкой выключает проп `paused` (`stage.eventMode = 'none'` и
сброс жеста), а отпускание не над канвасом Pixi отдаёт как
`pointerupoutside`, поэтому тап по слою хоста выход не жмёт (подробно -
[docs/custom-host.md](./docs/custom-host.md)).

## Тексты

Тексты интерфейса - только русский, без i18n-библиотеки и переключения
языков. Видимые игроку и автору уровня строки лежат типизированным `as const`
словарём у слоя, который их показывает (строка с параметром - функция):

- `widgets/game/texts.ts` - `GAME_TEXTS`: хайп-фразы каскада
  (`COMBO_PHRASES` - его срез), отказ рантайма (`GAME_RUNTIME_FAILURE_TEXT`
  барреля - его срез), «Цель», «Очки», «Уровень N», подписи экрана;
- `widgets/modals/texts.ts` - `MODAL_TEXTS`, `pages/main/texts.ts` -
  `MAIN_TEXTS` (пример хоста);
- `widgets/levelConfigEditor/model/texts.ts` - `EDITOR_TEXTS`: весь
  интерфейс редактора, тосты, описание бот-проверки;
- `entities/game/texts.ts` - `LEVEL_VALIDATION_TEXTS`, `entities/level/texts.ts`
  - `LEVEL_TEXTS` (ошибки пака);
- `shared/texts.ts` - `SHARED_TEXTS` (подписи примитивов, словоформы «ход»).

Подписи и подсказки элементов - в скине, названия уровней - в данных уровня,
подписи витрины - в `showcaseCatalog`. `pages/minimalHost` держит свои три
строки в файле: он пример. Сообщения консоли в словари не входят. Подробно -
[docs/extending.md](./docs/extending.md#тексты).

## State

- Zustand - хост партии (`pages/main/model/useMainFlowStore`, с копией
  прогресса из `localStorage`), рантайм игры (`widgets/game/store`), layout
  store, modal store.
- React local state - краткоживущий UI state внутри pages/widgets.
- `localStorage` - прогресс паков, выключенный звук, черновики и ширины
  колонок редактора. Все ключи - `STORAGE_KEYS` в
  `shared/constants/model/storageKeys.ts` под префиксом `STORAGE_PREFIX`
  (`match3-pixi:…`); прогресс пака по умолчанию - на
  `match3-pixi:progress:v1`. Проект новый, поэтому переноса старых ключей нет.
  Префикс и версию в ключе у выпущенной игры не меняют - это обнулит прогресс.
  Список - [docs/extending.md](./docs/extending.md#ключи-localstorage).

TanStack Query/Redux/RTK Query сейчас не используются. Не добавляй их как
"существующий слой" в документацию или код без отдельного решения.

## Viewport И Отступы

Шаблон - обычная страница, вёрстка резиновая (подробно -
[docs/responsive-layout.md](./docs/responsive-layout.md)):

- `--app-viewport-height` пишет только `app/hooks/useViewportHeight` из
  `window.innerHeight` (`dvh` минимальные версии браузеров не гарантируют).
  Fullscreen-слои опираются на неё (`app-height`), а не на голый `100vh`.
- `--design-px` (масштаб дизайн-px) и `--app-frame-width` (колонка контента)
  считает `design-scale-root`: десктоп от 1024 - высота окна / 700, портрет -
  `100vw` / 360, ландшафт - высота / 800, отдельной ветки планшета нет.
  Колонка - `min(100vw, 360 * --design-px)`: на десктопе `360 / 700` высоты
  окна (1920x1080 -> 555 px).
- Страница красит фон во всю ширину окна (однотонный), содержимое кладёт в
  колонку миксином `app-frame` (главная - `.frame`).
- `index.html` без `viewport-fit=cover`: браузер сам держит страницу вне
  выреза, `env(safe-area-inset-*)` - ноль. Глобальных `--safe-area-*` и
  `option-safe-*` миксинов нет.
- Отступы под вырез и home-индикатор задаёт хост, встраивающий игру: проп
  `insets={{ top, bottom }}` у `GameScreenLazy` или переменные
  `--match3-inset-top/bottom` на предке; без обоих - `env(safe-area-inset-*)`.
  Виджет меряет их зондом (`lib/measureSceneInsets`) и раскладывает сцену одним
  правилом `lib/sceneLayout` (`resolveSceneLayout`): шапка, доска и бустеры
  внутри безопасной зоны, фон канваса до края. QA-флаг `?insets=47,34`.

## Styles

- Базовая стратегия - SCSS Modules.
- Shared global styles подключаются из
  [src/app/styles/index.scss](./src/app/styles/index.scss).
- Component-level styles лежат рядом с компонентом в `*.module.scss`:
  **один компонент - один файл стилей**. Общий файл на несколько компонентов
  не заводим, даже если они соседи по DOM-поддереву.
- Цвета - только через токены из
  [src/shared/styles/\_colors.scss](./src/shared/styles/_colors.scss)
  (`var(--bg-modal)`, `var(--colors-white)`, ...). Hex-литералы в компонентных
  стилях не заводим.
- Повторяющиеся поверхности (градиентная обводка карточек/кнопок) - миксины из
  [src/shared/styles/mixins/\_surfaces.scss](./src/shared/styles/mixins/_surfaces.scss):
  `gradient-border-surface`, `neutral-card-surface`, `neutral-chip-surface`,
  `violet-surface`, `dark-surface`, `pressable`. У
  `pressable($scale, $extra-transitions...)` дополнительные переходы
  передаются аргументами и дописываются к `transform`: отдельное объявление
  `transition` после миксина перекрыло бы отклик нажатия.
- Каркас страницы - миксин `page-shell` из
  [src/shared/styles/\_mixins.scss](./src/shared/styles/_mixins.scss):
  `.page { @include page-shell; }` - вся раскладка главной.
- Размеры и отступы - через `option()`; сырые `px` в компонентных стилях не
  заводим, иначе элемент перестаёт масштабироваться вместе с макетом.
- `--app-frame-width` и `--design-px` объявлены только в `design-scale-root`
  ([src/shared/styles/\_mixins.scss](./src/shared/styles/_mixins.scss));
  локальные переопределения запрещены. Колонка контента страницы - миксин
  `app-frame`, фон страницы - во всю ширину окна.
- Shared mixins и primitives должны иметь понятный public entrypoint.
- `prefers-reduced-motion` сознательно **не** поддерживается нигде в проекте -
  ни `@media (prefers-reduced-motion)` в стилях, ни `useReducedMotion()` в
  компонентах, ни вторых веток анимаций, которые надо тянуть параллельно
  основным. Исключений нет: игровой экран живёт по тому же правилу (см.
  [docs/game-flow.md](./docs/game-flow.md)). Довод - подача: анимации входа
  и смены экранов не украшают экран, а несут его. Правило сплошное, поэтому под него попала и служебная
  моторика: `:active`-scale миксина `pressable` и анимация высоты карточки
  модалки (`shared/modals/lib/useAnimatedContentHeight`).

## Assets

- SVG-иконки, которые рендерятся React-элементом, лежат в `src/assets/icons/**`
  и импортируются потребителем напрямую через `*.svg?react` (SVGR): так
  иконка красится `currentColor` и не тянет отдельный запрос. В `public/` из
  SVG остаются только те, что подставляются в CSS (`url()`, `mask-image`) -
  диагональные сетки секций. Остальные URL-ассеты (растр, шрифты) лежат
  в `public/` по подпапкам типа (`images/`, `fonts/`) и не
  импортируются модульно. Исключение - текстуры и иконки элементов: они в
  папке скина и импортируются `?url` (см. ниже).
- Из JS/TSX ссылки на `public` идут через
  [src/shared/lib/assets.ts](./src/shared/lib/assets.ts) (`publicAsset` +
  именованные экспорты, `import.meta.env.BASE_URL` - работает и при деплое на
  CDN-подпапку). SVG-компоненты из `src/assets` импортируются напрямую в
  потребителе. SVG, которому нужен URL (`<img>`), импортируется как
  `*.svg?url` (арт победы).
- Из CSS - абсолютные `/...` пути (пример: `/fonts/...`).
- Игровые текстуры и иконки элементов - часть скина
  (`src/entities/skin/skins/<name>/`, см. [docs/skin.md](./docs/skin.md)), а
  не `public/`: заменить скин - заменить одну папку. Два источника под общими
  ключами. Файлы (`textures.files`: кадры фишек, спецфишек, ящика, камня,
  льда, цепи в `images/`, 168 px) подключаются Vite-импортом `?url` - хеш в
  имени, база `VITE_CDN_BASE_URL` подставляется сборкой; грузит их
  `assetsConfig`, прогревает `warmGameAssets` - оба через
  `listSkinTextureFiles`, один URL. Всё остальное (клетки поля, слизь, «опусти
  вниз», колесо радуги, подложка, интерфейс партии с кнопкой звука, иконки
  бустеров, эффекты) рисуется Canvas 2D при старте партии - процедурное
  рисование скина (`art/*`, `textures.art`), регистрирует
  `registerProceduralTextures` (`widgets/game/textures/proceduralTextures`), и только он: сущности и
  модули своих текстур не генерируют. Файл под ключом процедурной текстуры
  её переопределяет (холст не рисуется). Исходные атласы кадров
  (`assets-for-new-match3/`) в `.gitignore` - чужой арт без подтверждённых
  прав: кадры скина `default` до выпуска проекта нужно подтвердить по правам
  или заменить (README, [docs/skin.md](./docs/skin.md)). Что показывается и в DOM, имеет иконку в скине (`icons/`, для кадров -
  тот же файл). Масштаб записывается **дробью «дизайн-px / ширина
  текстуры»**, не готовым десятичным множителем: числитель фиксирует, каким
  спрайт обязан выглядеть, при перевыгрузке арта правится только знаменатель -
  в скине. Знаменатель берётся из скина (`skinTextureWidth(key)`: ширина
  файла или холста), поэтому картинка, заменившая холст, сохраняет размер.
  Текстуры элементов на доске - ширины `cellWidth` (`CELL_TEXTURE_WIDTH`):
  доска и панель целей (`GameGoalsPannel`) берут общий `BASE_SCALE`.
  Подробности - в [docs/game-flow.md](./docs/game-flow.md#откуда-берутся-игровые-текстуры).
- `RENDER_DPR_CAP = 3` (`widgets/game/configs/renderScale.ts`): разрешение
  печати текста считается от `worldScale`, а не от DPR. Стартовый размер
  канваса кладёт в `renderScale` сам `bootGameRuntime()` (тот же владелец,
  что сбрасывает `GameStore`), он же зовёт
  `resetRenderCanvasSize()` на `destroy`; экраны обновляют размер только на
  ресайзе.

## Анти-Паттерны

- Не описывать production game-core/tree/shop seams, жизни/монеты или перевод
  экранов на backend как активный runtime, пока потребители не появились в
  коде. `entities/game` - это формат уровня и его валидация, движок и чистые
  правила доски (очки, звёзды), бот-солвер и виды бустеров; сессии и прогресса
  там нет - прогресс живёт у хоста (правила - `features/match3Host`).
- Не импортировать пример хоста (`pages/main`, продуктовые модалки
  `widgets/modals`) из `widgets/game`, `widgets/levelConfigEditor`,
  `features`, `entities` и `shared`: копия шаблона удаляет его целиком (см.
  [docs/custom-host.md](./docs/custom-host.md)). Общее правило хоста
  выносится в `features/match3Host`, а не берётся из `pages/main`.
- Не импортировать вверх по слоям (`app → pages → widgets → features →
entities → shared`) и не ходить в чужой слой относительным путём - только
  алиасом `@/`. Границы держит ESLint (`no-restricted-imports`, блок
  `layerBoundaries` в `eslint.config.js`): импорт вверх, `@/widgets/modals`
  вне `app`/`pages/main`, скин, `?url` и `@/shared/lib/assets` в
  `entities/game` (и относительные пути из `entities/game` в соседние срезы
  `entities`). Баррель `@/widgets/game` без Pixi, GSAP и Spine
  сторожит тест `widgets/game/barrelPixiFree.test.ts` (обходит статический граф импортов):
  ESLint транзитивных импортов не видит.
- Не хардкодить видимые строки в компонентах и модулях: только словарь слоя
  (см. «Тексты»). Новая строка - ключ в словаре, а не литерал по месту.
- Не заводить ключ `localStorage` литералом по месту: только `STORAGE_KEYS`.
- Не тянуть в `widgets/game` знание о хосте: уровни каталога, модалки,
  маршруты, прогресс и знакомые механики - зона хоста, виджет общается с ним
  только пропсами и колбэками `IGameScreenProps`.
- Не оставлять на устоявшейся доске пустых клеток: клетку, куда ничто не
  падает (верх под серединой ряда неподвижных шире двух, замкнутый карман),
  движок добирает на месте (`planBoardGravity`, `inPlace` в шаге `settle`),
  рантайм выращивает фишку в клетке, а не везёт сверху сквозь блокер. Тест
  каталога требует ноль пустых клеток после хода.
- Не класть правила доски в `GameLogic` и не брать в них `Math.random`: что
  разрушить, куда упасть и какого цвета добор, решает `BoardEngine` от зерна
  партии, рантайм только проигрывает его шаги.
- Не класть подписи, иконки, ключи текстур, цвета частиц и тексты подсказок
  элементов мимо скина (`entities/skin`): ни в `entities/game` (домен не
  импортирует ни скин, ни `?url`, ни `@/shared/lib/assets`), ни таблицами в
  редакторе, модалках или модулях рантайма - только запись элемента в скине и
  чтение через реестр. Вид на доске выбирается реестром `BOARD_VIEWS`, а не
  `switch` по коду. Способ рисования клетки выбирает `board.view` скина и
  реестр `CELL_VIEW_KINDS`, анимацию шага - реестр `modules/steps`; новый
  `switch` по виду шага или вида клетки не заводим.
- Не ссылаться в активной документации на локальные пути других проектов.
- Не добавлять OpenAPI/RTK Query/Redux/TanStack Query правила как текущий
  контракт, пока этих слоёв нет в коде.
- Не импортировать route-local internals в reusable modules.
- Не открывать cross-route модалки локальным `useState`, если сценарий должен
  быть доступен из разных routes/runtime events; используй `useModalsStore`.
- Не добавлять `@media (prefers-reduced-motion)` в стили и `useReducedMotion()`
  в компоненты - нигде, включая `widgets/game` и `pages/editor`:
  правило снято намеренно и сплошным (см. Styles), а не потеряно по
  недосмотру.

## Documentation Sync

Если меняются routes, shell composition, state responsibilities,
viewport/insets contract, public exports или style conventions, обновляй
`CLAUDE.md`, `AGENTS.md` и нужные файлы в `docs/` в той же задаче.
Индекс типовых расширений (скин, механика, анимация, хост, уровни, тексты,
ключи хранилища) - [docs/extending.md](./docs/extending.md).
