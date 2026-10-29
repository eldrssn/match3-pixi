# Responsive Layout

Шаблон - обычная веб-страница: ни моста в нативное приложение, ни safe-area
runtime, ни десктопной «телефонной» рамки. Вёрстка резиновая: всё задаётся в
дизайн-пикселях макета 360 px и масштабируется одним коэффициентом. Отступы под
вырез и home-индикатор - забота хоста, в который встраивают игру (см.
«Отступы Игры»).

## Где Живёт Контракт

- [index.html](../index.html) - viewport meta без `viewport-fit=cover`.
- [src/app/App.tsx](../src/app/App.tsx) - каркас `.root` на всю видимую высоту
  окна, `useViewportHeight()` и `useIOSGestureHack()`.
- [src/app/hooks/useViewportHeight.ts](../src/app/hooks/useViewportHeight.ts) -
  единственный владелец `--app-viewport-height`.
- [src/shared/styles/\_mixins.scss](../src/shared/styles/_mixins.scss) -
  `design-scale-root` (`--design-px`, `--app-frame-width`), `option`,
  `app-frame`, `page-shell`, `app-height`.
- [src/shared/styles/index.scss](../src/shared/styles/index.scss) - глобальное
  подключение `design-scale-root` и `--app-vh`.
- [src/widgets/game](../src/widgets/game) - канвас партии и отступы сцены
  (`IGameScreenProps.insets`, `configs/sceneInsets.ts`, `lib/sceneLayout.ts`,
  `configs/renderScale.ts`, `core/GameRuntimeCore.ts`).

## Высота Окна

`--app-viewport-height` пишет `useViewportHeight()` из `window.innerHeight` на
`resize`, `pageshow` и через два кадра после `orientationchange`. До первого
замера действует фолбэк `100vh` из `shared/styles/index.scss`. `dvh` не
используется: минимальные версии браузеров шаблона его не гарантируют.

Для fullscreen-слоёв не используй голый `100vh` - мобильный браузер включает в
него спрятанные панели:

```scss
.screen {
  @include app-height(height);
}
```

Height-based функции `vh`, `vhm`, `vht` считаются от `--app-vh`
(`calc(var(--app-viewport-height, 100vh) / 100)`).

## Design Scale

`design-scale-root` задаёт `--design-px` один раз на `:root`:

| Условие                  | Формула           | Пример          |
| ------------------------ | ----------------- | --------------- |
| ширина от 1024 (десктоп) | высота окна / 700 | 1080 -> 1.54 px |
| ширина до 1024, портрет  | `100vw` / 360     | 390 -> 1.08 px  |
| ширина до 1024, ландшафт | высота окна / 800 | 390 -> 0.49 px  |

Отдельной ветки планшета нет: портретный планшет ведёт себя как телефон.

## Колонка Контента

`--app-frame-width` - ширина колонки контента:
`min(100vw, 360 * var(--design-px))`. На портрете это вся ширина окна, на
десктопе - `360 / 700` высоты окна (1920x1080 -> 555 px, 1280x800 -> 411 px).
Колонка и всё, что в ней задано через `option`, масштабируются одним
коэффициентом, поэтому пропорции макета держатся при любой высоте окна, а
ширина окна на раскладку не влияет.

Страница красит фон сама и во всю ширину окна (однотонный), а содержимое кладёт
в колонку миксином `app-frame`:

```scss
.page {
  @include page-shell;
  background: var(--bg-main);
}

.frame {
  @include app-frame;
}
```

Так устроена главная (`pages/main`): и кнопки, и экран партии живут в `.frame`,
а канвас партии занимает доску экрана внутри неё (см. «Канвас Партии»). Слой модалок лежит вне колонки на всё окно:
затемнение ложится на весь фон, а карточка задана через `option` и по ширине
совпадает с колонкой.

### Исключение: `/editor`

Редактор уровней - full-width dev-страница: `app-frame` он не использует и
занимает всё окно (слева конструктор, справа превью на `widgets/game`).

## Обычные UI-Размеры

Для большинства размеров используй `option`:

```scss
.card {
  @include option(width, 320);
  @include option(padding, 16);
  @include option(border-radius, 24);
  @include option(font-size, 16);
}
```

Числа внутри `option` - значения из макета, то есть дизайн-пиксели. Вызов с
одним значением раскрывается через `to-design-px()` в
`calc(N * var(--design-px))`. Расширенная форма
`option(..., value, mobile, tablet)` раскрывается старыми media-ветками и в
проекте не используется - не заводи её без явного требования макета.

Результат `vh`/`vhm`/`vht` и `to-design-px()` - CSS `calc(...)`, а не
Sass-число: складывай их только внутри CSS `calc`.

## Отступы Игры

Обычной странице отступы не нужны: без `viewport-fit=cover` браузер сам держит
контент вне выреза, и `env(safe-area-inset-*)` равен нулю. Хосту, который
показывает игру на весь экран (нативный WebView, PWA с `viewport-fit=cover`),
отступы сверху и снизу передаются виджету:

- пропом `insets={{ top, bottom }}` у `GameScreenLazy` (CSS px);
- или CSS-переменными `--match3-inset-top` / `--match3-inset-bottom` на любом
  предке экрана партии. Проп важнее переменных, без обоих берётся
  `env(safe-area-inset-*)`.

Фон канваса доходит до края, а шапка, доска и бустеры внутрь отступов не
заходят: масштаб мира считается по безопасной зоне (`resolveSceneLayout`).
Значения виджет не парсит, а меряет: зонд `.safeArea` внутри доски растянут
от `--match3-inset-top` до `--match3-inset-bottom`, и
`lib/measureSceneInsets` берёт его бокс относительно доски (в переменных
могут быть `var()`/`env()`/`calc()`).
Подробности - [game-flow.md](./game-flow.md#отступы-сцены).

QA-флаг `?insets=47,34` имитирует такой хост в обычном браузере (`?insets=47` -
только сверху).

Внутри безопасной зоны поле любого размера (3×3 - 9×9) вписывается в область
макетного 6×6: `widgets/game/lib/boardFit` ужимает поле крупнее 6×6 одним
множителем по обеим осям, меньшие поля идут в макетном размере - шапка и
бустеры под размер поля не перестраиваются.

## Канвас Партии

Канвас Pixi занимает ровно доску экрана партии (`.board` в `GameScreen`) и
рисует в физических пикселях, а сцена живёт в CSS px:

- `model/useGameRuntime` меряет CSS-размер доски
  (`lib/resolveCanvasCssSize`: `getBoundingClientRect`, округление до целых
  CSS px, `null` до замера) и отдаёт его рантайму - на старте
  (`bootGameRuntime({ canvasSize })`, чтобы `Application.init` сразу поднял
  бэкбуфер нужного размера), затем на `ResizeObserver` доски и зонда
  безопасной зоны, на `resize` окна (смена DPR зумом браузера), на смену
  отступов и качества, через кадр и через 100 мс после маунта.
- `Application.init` получает `resolution` = `getRenderDpr()` и
  `autoDensity: true`; ресайз - `GameRuntimeCore.resize`:
  `renderer.resize(cssW, cssH, dpr)`. Бэкбуфер - CSS-размер × DPR, стиль
  канваса - CSS-размер (на 375x812 при DPR 2: канвас 750x1624, стиль
  375x812). Ресайз на паузе дорисовывает кадр вручную: тикер стоит, а ресайз
  чистит бэкбуфер.
- DPR отрисовки (`configs/renderScale`, `getRenderDpr`) - экранный, но не выше
  `RENDER_DPR_CAP = 3`; низкое качество (перф-гейт или `?perf=low`,
  `configs/renderQuality`) опускает кап до `LOW_QUALITY_DPR_CAP = 1.5`, и
  `useGameRuntime` пересобирает канвас тем же ресайзом.
- Размер бэкбуфера рантайм публикует `setRenderCanvasSize`; от него
  `getWorldScale()` и `getTextResolution()` (`ceil` масштаба мира) считают
  разрешение печати текста холста. Сбрасывает его `bootGameRuntime` - на
  старте партии без замера и на `destroy`.
- Раскладка сцены - одно правило `lib/sceneLayout` (`resolveSceneLayout`): мир
  дизайн-сетки 360x744 вписывается в безопасную зону канваса (высота минус
  отступы сверху и снизу), модули получают `scale`, `top`, `bottom`, `centerY`
  в событии `resize` шины рантайма.

## Positioning Rules

Fullscreen-слои внутри страницы - `position: absolute` внутри контейнера с
известной высотой, а не новый `position: fixed`. Исключение - слой модалок
(`shared/modals`): он отдельный узел в `body` и обязан покрывать всё окно.

## Быстрые Правила Для Агентов

- Обычный UI-size, padding, radius, font-size или offset - `@include option(...)`
  с одним значением.
- Fullscreen высота - `@include app-height(...)`, не новый `100vh`.
- Содержимое страницы - в колонке `app-frame`, фон - на странице во всю ширину.
- Масштаб и ширина колонки правятся в одном месте - `design-scale-root`; не
  заводи параллельные формулы и локальные переопределения `--design-px` /
  `--app-frame-width`.
- Отступы под вырез - только через `insets` / `--match3-inset-*` виджета, а не
  глобальные safe-area переменные.

## Что Обновлять При Изменениях

Если меняются viewport/layout rules, обновляй вместе с кодом:

- `useViewportHeight` и CSS-переменные высоты;
- `design-scale-root`, `app-frame`, `option`;
- контракт отступов виджета (`IGameScreenProps.insets`);
- размер канваса и DPR (`configs/renderScale`, `GameRuntimeCore.resize`,
  `lib/sceneLayout`);
- ссылки на этот документ в `CLAUDE.md`, `AGENTS.md`, `docs/CODEMAP.md`,
  `docs/architecture.md`, `docs/conventions.md`.
