# Свой хост партии

Главная `/` (`src/pages/main`) с картой уровней, витриной, карточками
`levelStart`/`outOfMoves`/`victory`/`defeat` (`src/widgets/modals`) и
прогрессом в `localStorage` - **пример** хоста. Копия шаблона может удалить
её целиком или написать свою: виджет партии (`src/widgets/game`) и редактор
(`/editor`, `src/widgets/levelConfigEditor`) от неё не зависят.

Что от чего зависит:

| Слой                                               | Что это                                                     | Знает про главную |
| -------------------------------------------------- | ----------------------------------------------------------- | ----------------- |
| `widgets/game`                                     | экран партии `GameScreenLazy`, рантайм на Pixi v8 + GSAP    | нет               |
| `widgets/levelConfigEditor`                        | конструктор паков, превью - тот же `GameScreenLazy`         | нет               |
| `features/match3Host`                              | чистые правила хоста: прогресс, бустеры, «+ходы», подсказки | нет               |
| `entities/level`, `entities/game`, `entities/skin` | паки, формат уровня, движок, скин                           | нет               |
| `pages/main`, `widgets/modals`                     | пример хоста и его карточки                                 | -                 |

## API экрана партии

`GameScreenLazy` из `@/widgets/game`. Баррель статически не тянет Pixi, GSAP
и Spine (сторож - `barrelPixiFree.test.ts`): рантайм приезжает отдельным
чанком (`ui/gameScreenChunk`, прогрев - `prefetchGameScreenChunk`). Контракт -
`IGameScreenProps` (`widgets/game/model/gameScreenTypes.ts`); типы пропсов
(`ISceneInsets`, `TRenderQualityMode`, `TRendererMode`, `TBoardEvent`,
`TGameRuntimeFailure`, `IGameOutcome`, `IOutOfMovesOffer`) - тоже из барреля.

Пропсы:

- `level: IMinigameLevelConfig` - уровень (`getPackLevel(pack, n)`,
  `getShowcaseLevel(key)` или свой JSON того же формата).
- `boosters: IGameStartBooster[]` - бустеры партии; пустой список прячет
  панель.
- `preBoosters?` - предуровневые спецфишки (`laser`/`bomb`/`rainbow`), которые
  встанут на стартовую доску.
- `tutorial?` - механики, подсказки которых показать перед первым ходом.
- `paused?` - заморозить сцену и ввод, пока поверх доски висит слой хоста
  (карточка, своё меню).
- `insets?: { top, bottom }` - отступы под вырез и home-индикатор, CSS px. То
  же задают переменные `--match3-inset-top/bottom` на предке; без обоих -
  `env(safe-area-inset-*)`.
- `seed?` - зерно добора и перемешки: та же партия при тех же ходах.
- `quality?` - `auto` (перф-гейт), `high` или `low`.
- `renderer?: TRendererMode` - какой рендерер просить у Pixi: `auto` (по
  умолчанию) - WebGPU с откатом на WebGL, `webgpu`/`webgl` - предпочтение
  (`Application.init({ preference })`). Без WebGPU в браузере `webgpu` даёт
  WebGL, а не отказ; без обоих рендереров - `onError('context-lost')`. QA-флаг
  `?renderer=` у главной (`readQueryRenderer`).
- `debug?` - отладочные кнопки исхода поверх доски.
- `title?` - подпись под доской; без неё «Уровень N» по `level.id`.

Колбэки:

- `onFinish({ isVictory, score, stars })` - партия доиграна (финальная сцена
  закончилась). `stars: null` - у уровня нет порогов `starScores`.
- `onOutOfMoves?(offer)` - ходы кончились, цели нет. Без колбэка партия сразу
  кончается поражением; с ним рантайм ждёт `offer.continueWith(moves)` или
  `offer.giveUp()`. Наличие колбэка читается на старте партии.
- `onTutorialSeen?(mechanic)` - игрок закрыл подсказку механики.
- `onExitRequest()` - кнопка выхода в канвасе; подтверждать ли, решает хост.
- `onError(failure)` - рантайм отказал; тексты -
  `GAME_RUNTIME_FAILURE_TEXT[failure]`.
- `onBoardEvent?(event)` - события партии (`TBoardEvent`: ход, каскад,
  спецфишка, шаг и закрытие цели, бустер, очки) для аналитики, вибрации, своих
  звуков. На ход партии не влияют.

Правила жизни экрана:

- **Одна партия - один маунт.** Новая партия (повтор, следующий уровень) -
  новый `key`, а не смена `level`.
- **Живой рантайм один** (`GameStore`, `renderScale`, `sceneInsets` -
  синглтоны): два экрана партии одновременно не монтируются. Страховка в
  `lib/bootGameRuntime`: второй поднятый рантайм гасит прошлый с
  `console.warn`, но два экрана подряд всё равно делили бы стор. Старый экран
  отпускает рантайм микротаской после cleanup (`model/useGameRuntime`; так
  StrictMode с его mount -> cleanup -> mount не поднимает второй `Application`),
  поэтому новый монтируйте не тем же коммитом, что размонтировали старый: между
  партиями покажите что-нибудь своё (результат, карточку) или отложите маунт
  задачей (`setTimeout`), как превью редактора (`model/usePreviewSession`).
- Экран тянется по родителю: дайте ему контейнер с высотой (`page-shell` +
  `app-frame`, как в примере ниже).
- Канвас занимает ровно доску экрана: её CSS-размер
  (`lib/resolveCanvasCssSize`) уходит в `renderer.resize`, физическое
  разрешение добавляет `resolution` = DPR (см.
  [responsive-layout.md](./responsive-layout.md#канвас-партии)).
- Пока поверх доски слой хоста, держите `paused`: виджет зовёт у рантайма
  `setPaused` (тикер Pixi, часы и твины GSAP, звук) и `setInputEnabled(false)`
  (`stage.eventMode = 'none'` и сброс незавершённого жеста). `inert` на `#root`
  этого не заменяет: `EventSystem` Pixi ловит `pointerdown` на канвасе, но
  `pointermove` - на `document`, а `pointerup` - на `window` (в фазе
  перехвата), так что движение и отпускание с узла слоя модалок вне `#root`
  до сцены доходят: без паузы жест, начатый на доске до появления слоя,
  продолжился бы и закрылся под ним. Кнопка выхода (`modules/ExitButton`) срабатывает по
  `pointerup` на самой кнопке; отпускание не над канвасом Pixi отдаёт как
  `pointerupoutside`, поэтому тап по слою хоста выход не жмёт.

## Готовые правила

`@/features/match3Host` - чистые функции и константы без React, стора и
модалок; на них стоят и главная, и превью редактора.

- Прогресс по паку в `localStorage`: `readLevelProgress(packId)`,
  `writeLevelProgress(packId, progress)`, `applyPartyResult` (победа открывает
  следующий уровень и улучшает звёзды и очки), `resolveCurrentLevel`,
  `isLevelUnlocked`, `levelProgressStorageKey`, `parseLevelProgress`,
  `EMPTY_LEVEL_PROGRESS`. Хост с сервером берёт только чистые правила, а
  чтение и запись пишет свои.
- Подсказки механик: `resolveTutorial(level, progress)` - механики уровня
  (`listLevelMechanics` из `@/entities/game`) минус уже знакомые;
  `markMechanicSeen(progress, mechanic)` - на `onTutorialSeen`.
- Выбор уровня: `resolveStartLevelNumber(queryLevel, current, count)` (QA-флаг
  `?level=N` из `readQueryLevel`), `resolveNextLevelNumber(n, count)`.
- Бустеры: `resolvePartyBoosters(n)` (первый уровень без бустеров, дальше
  `DEFAULT_LEVEL_BOOSTERS`), `resolvePreBoosterOptions(n)`.
- «+ходы»: `resolveContinueOffer(continuesUsed)` - сколько ходов предложить или
  `null` (`NEAR_MISS_EXTRA_MOVES`, `MAX_CONTINUES_PER_PARTY`).

Набор кнопок карточки результата (`resolveGameResultActions`) остался в
`widgets/modals`: это подписи именно тех карточек, а не правило игры.

## Минимальный хост

`src/pages/minimalHost/MinimalHost.tsx` - около 60 строк: первый уровень
пака по умолчанию, `onFinish`/`onExitRequest`/`onError` и «Ещё раз» через
новый `key`. Маршрута у него нет, но он лежит в `src` и проходит type-check и
lint, чтобы не отставать от API. Подключить:

```tsx
// src/app/routing/Routes.tsx
import { MinimalHost } from '@/pages/minimalHost/MinimalHost';

<Route path={ROUTES.MAIN} element={<MinimalHost />} />;
```

## Как убрать пример хоста

1. Удалить `src/pages/main` и, если карточки не нужны, `src/widgets/modals`.
2. В `src/app/routing/Routes.tsx` поставить на `ROUTES.MAIN` свой хост (или
   `MinimalHost`).
3. Если удалён `src/widgets/modals` - убрать `ModalsProvider` из
   `src/app/App.tsx` (generic-слой `src/shared/modals` остаётся и годится для
   своих модалок, см. [modals.md](./modals.md)).
4. Удалить ставшие ненужными тексты в `docs/` (`modals-catalog.md`, разделы
   главной в `game-flow.md`) и строки в `CLAUDE.md`/`AGENTS.md`.

Так проверено на копии шаблона: без `src/pages/main` и `src/widgets/modals`, с
`MinimalHost` на `/` проходят `type-check`, `lint`, unit-тесты и `build` (в
том числе с `VITE_ENABLE_EDITOR=true`), партия и выход работают в браузере.

## Редактор

Редактор от главной не зависит: превью - тот же `GameScreenLazy`, а
редактор в нём - хост со своими правилами (`model/previewOptions`).
Предложение «+ходы» превью считает тем же `resolveContinueOffer`, а
показывает своей плашкой поверх доски (`ui/LevelConfigPreviewContinue`), а не
карточкой `outOfMoves`: удалённые `widgets/modals` его не ломают. Маршрут
`/editor` и флаг `VITE_ENABLE_EDITOR` живут в `Routes.tsx` отдельно от `/`;
при замене главной их не трогайте. Кнопка «Редактор» была на главной - в
своём хосте ссылку на `ROUTES.EDITOR` ставьте под `__EDITOR_ENABLED__`.
