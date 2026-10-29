# match3-pixi - Match-3 Template на Pixi

> Порт Phaser-шаблона Match-3 на Pixi v8 + GSAP 3 + Spine с тем же
> функционалом; перенос завершён, история и отклонения -
> [docs/PLAN.md](./docs/PLAN.md). Проект самодостаточный: папка готова стать
> отдельным git-репозиторием (см. «Перенос в отдельный репозиторий»).

Vite + React шаблон классической Match-3 без бэкенда, обычная веб-страница:
главная с кнопками «Играть», «Уровни», «Витрина» и «Редактор», карта уровней со звёздами,
партия (спецфишки и комбинации, препятствия, очки и звёзды, финальный
бонус, near-miss, предуровневые бустеры, обучение механикам), конструктор
уровней с проверкой ботом. Уровни - JSON в репозитории (пак из 30 по кривой
сложности жанра), прогресс - в `localStorage`. Вёрстка резиновая, на десктопе
содержимое стоит в колонке `360 / 700` высоты окна.

## Документация

- [CLAUDE.md](./CLAUDE.md) - главный project brief
- [AGENTS.md](./AGENTS.md) - entrypoint для AI-агентов
- [docs/PLAN.md](./docs/PLAN.md) - инварианты проекта, история переноса на Pixi и журнал фаз
- [docs/CODEMAP.md](./docs/CODEMAP.md) - быстрый индекс entrypoints
- [docs/architecture.md](./docs/architecture.md) - shell, routing, module layers
- [docs/levels.md](./docs/levels.md) - формат уровней, пак, бот-солвер, редактор, прогресс
- [docs/match3-roadmap.md](./docs/match3-roadmap.md) - план до классической Match-3 и статус этапов
- [docs/game-flow.md](./docs/game-flow.md) - геймфлоу «Играть → партия → результат» и рантайм на Pixi: жизненный цикл, ввод, твины, текстуры, эффекты, WebGPU/WebGL, Spine, бюджет бандла, известные ограничения
- [docs/custom-host.md](./docs/custom-host.md) - свой хост партии вместо главной: API экрана партии, готовые правила, что удалить
- [docs/skin.md](./docs/skin.md) - скин: арт, цвета, шрифт, звуки, темп доски
- [docs/extending.md](./docs/extending.md) - как расширять шаблон: механика, анимация, тексты, ключи `localStorage`

## Как расширять шаблон

Короткий индекс - [docs/extending.md](./docs/extending.md):

- заменить арт, цвета, шрифт, звуки - [docs/skin.md](./docs/skin.md);
- добавить блокер или спецфишку - [extending.md#как-добавить-механику](./docs/extending.md#как-добавить-механику);
- поменять анимацию - [extending.md#как-поменять-анимацию](./docs/extending.md#как-поменять-анимацию);
- уровни и паки - [docs/levels.md](./docs/levels.md);
- свой хост партии - [docs/custom-host.md](./docs/custom-host.md);
- тексты интерфейса - словари слоёв, [extending.md#тексты](./docs/extending.md#тексты).

> **Права на арт.** Кадры фишек, спецфишек и блокеров в скине по умолчанию
> (`src/entities/skin/skins/default/images/`, `icons/`) взяты из атласов без
> подтверждённых прав. До выпуска проекта права нужно подтвердить или
> заменить кадры своими ([docs/skin.md](./docs/skin.md#как-заменить-скин)).

> **Лицензия Spine.** Spine Runtimes (`@esotericsoftware/spine-pixi-v8`)
> можно использовать, только имея лицензию Spine Editor
> ([Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license)):
> она нужна тому, кто собирает и выпускает проект с видом клетки `spine`.

## Стек

- **React**, **TypeScript**, **Vite**, **SCSS Modules**
- **Zustand** - состояние (сценарий партии, рантайм игры, модалки)
- **Pixi v8** (`pixi.js`) + **GSAP 3** - игровой рантайм (ленивые чанки `GameScreen`, `pixi`, `gsap`; WebGPU с откатом на WebGL)
- **Spine** (`@esotericsoftware/spine-pixi-v8`) - вид клетки `spine` (ленивый чанк `spine`: качается, только если активный скин использует вид `spine`; см. [docs/skin.md](./docs/skin.md))
- **Vitest** + **React Testing Library** - unit-тесты

### Установка зависимостей

- npm install (или `npm ci` для чистой установки)

### Запуск

- npm run dev (порт 3000)

### Тестирование

- npm test (проект `unit` в watch: без медленных тестов)
- npm run test:slow (проект `slow`: бот-проверка каталога и перф-гейт движка)
- npm run test:ci (оба проекта однократно, его же гоняет CI-задача `test`)
- npm run bundle:check (после `npm run build`: бюджет чанков - стартовый без движка, `GameScreen`, `pixi`, `gsap`, `spine`; CI-задача `bundle`)
- npm run test:coverage
- npm run levels:report (сложность паков уровней ботом-солвером)
- npm run levels:import <file> (файл пака из редактора -> `src/entities/level/packs/<id>`)

### Линтинг

- npm run lint
- npm run lint:fix

### Git-хуки

- `npm install`/`npm ci` запускают `prepare` (`husky`): в репозитории, где эта
  папка - корень git, Husky ставит `core.hooksPath = .husky/_`, и
  `.husky/pre-commit` гоняет `npx lint-staged` (Prettier + ESLint по
  staged-файлам).
- Хуков graphify в репозитории нет; авто-обновление графа - по желанию,
  локально: `graphify hook install` (см. `CLAUDE.md`).

### Основные переменные

- `VITE_APP_ENV` - Окружение: `dev` | `test` | `production`

### Бэкенд

Бэкенда нет: приложение статично, авторизации, API-запросов и внешних SDK
больше нет. Во вкладке Network - только same-origin статика.

## Как добавить уровень

1. Откройте `/editor` (конструктор паков уровней; есть в `npm run dev` и в
   сборке с `VITE_ENABLE_EDITOR=true`).
2. Выберите пак, добавьте или откройте уровень в списке, соберите поле,
   задайте название, проверьте секцией «Проверка ботом»
   (сложность, пороги звёзд). Правки хранятся в браузере.
3. «Экспорт» - файл пака `pack_<id>.json`; положите его в репозиторий:
   `npm run levels:import pack_<id>.json` (проверка, раскладка в
   `src/entities/level/packs/<id>/`, отчёт бота).
4. Проверки каталога (`levelCatalog.test.ts`, `levelCatalog.bot.test.ts`) и
   гейт (`npm run type-check`, `npm run lint`, `npm run test:ci`,
   `npm run build`) - зелёные.

Проверить конкретный уровень - `?level=N`, кнопки ручного исхода партии -
`?gameDebug=true`, рендерер - `?renderer=webgl|webgpu` (без флага - WebGPU с
откатом на WebGL). Подробнее - [docs/levels.md](./docs/levels.md).

## Сборка

### Общая (локально - через .env; в CI - через BUILDS_ENV)

- npm run build

### Просмотр dist локально

- npm run preview

### Пайплайны GitLab

Сборочные `VITE_*`-переменные задаются через Project Variable `BUILDS_ENV` (тип File), а не через обычные Variable/build args:

| Окружение         | Переменная   | Environment scope | Protected |
| ----------------- | ------------ | ----------------- | --------- |
| Тестовое (`tst`)  | `BUILDS_ENV` | `tst`             | да        |
| Продакшен (`prd`) | `BUILDS_ENV` | `prd`             | нет       |

- CI-шаблон материализует File variable `BUILDS_ENV` в `builds_file.env` в build-контексте.
- Job-level `BUILDS_ENV_STRING` материализуется в `builds_string.env` и перекрывает значения из `builds_file.env`.
- `vite.config.ts` читает оба файла через `config/buildEnv.ts`; `${BUILDS_ENV}` не нужно подставлять в YAML как строку.
- Production build требует только `VITE_APP_ENV`.

## Развёртывание и эксплуатация

Frontend — статический SPA-артефакт. Его можно публиковать из nginx/container, object storage + CDN или любой другой static-hosting платформы. Он не требует собственной БД и backend API.

### Build-time конфигурация

Все `VITE_*` переменные подставляются при `npm run build`/Docker build и становятся доступными пользователю в JavaScript bundle. Это **не** secrets: не указывайте в них tokens, пароли, private keys или внутренние hostname.

| Переменная           | Обязательность | Назначение                                                                                                                      |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_ENV`       | да             | `dev`, `test` или `production`                                                                                                  |
| `VITE_CDN_BASE_URL`  | опционально    | base path статического bundle при публикации не в `/`                                                                           |
| `VITE_ENABLE_EDITOR` | опционально    | `true` - в сборке есть редактор уровней `/editor` (стейдж геймдизайнера); по умолчанию `false` в сборке, `true` в `npm run dev` |

Пример значения `BUILDS_ENV` для GitLab File variable:

```dotenv
VITE_APP_ENV=dev
```

Значения для `VITE_*` фиксируются в версии артефакта.

### Публикация

1. Выберите публичный HTTPS hostname и base path. Для SPA proxy/CDN должен возвращать `index.html` на неизвестные клиентские routes.
2. Соберите артефакт с production `VITE_*`:

```bash
npm ci
npm run build
```

3. Опубликуйте `dist/` с cache policy: immutable hash-named assets — длительный TTL, `index.html` — короткий TTL/no-cache.
4. После deploy откройте `/healthz` и пройдите минимальный игровой путь: «Играть», «Играть» на карточке уровня, победа (`?gameDebug=true`), «Дальше».

### Health, мониторинг и откат

| Endpoint       | Назначение                                |
| -------------- | ----------------------------------------- |
| `GET /healthz` | liveness/readiness static nginx container |
| `GET /metrics` | nginx-prometheus-exporter                 |

Откат frontend выполняется переключением на предыдущий immutable static artifact и purge/invalidation CDN только для `index.html`, если это требуется CDN.

### Что предоставляет репозиторий / что предоставляет клиент

| Репозиторий                                                              | Клиентская платформа                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Исходники SPA, Dockerfile/nginx template, build scripts и `.env.example` | CDN/static hosting, TLS/DNS, cache invalidation, observability |

## Перенос в отдельный репозиторий

Пока папка лежит внутри репозитория исходного Phaser-шаблона:

- `prepare` (`husky`) печатает «.git can't be found» и ничего не ставит:
  `.git` рядом с `package.json` нет, хуки корневого репозитория не
  трогаются, а `.husky/pre-commit` этой папки не работает - на коммите
  запускается корневой lint-staged, но корневые Prettier и ESLint эту папку
  игнорируют, так что её файлы перед коммитом проверяют вручную
  (`npm run lint`, `npm run format:check`);
- `.gitlab-ci.yml` этой папки GitLab не читает (читается только корневой).

После переноса (папка - корень нового репозитория):

1. `git init` (или клон нового пустого репозитория) и `npm ci` - Husky
   поставит `pre-commit`.
2. Создать `.env` из `.env.example` (сборке нужен `VITE_APP_ENV`; `.env` в
   `.gitignore`), в GitLab - File variable `BUILDS_ENV`.
3. Проверить, что группе доступен внешний `devops/ci-cd/templates`
   (`include` в `.gitlab-ci.yml`) и раннеры задач `test`/`bundle` (`node:22`);
   заменить плейсхолдер CDN-ссылки `cdn.example.com` в `BUILDS_ENV_STRING`.
4. По желанию - `graphify update .` и `graphify hook install`.
5. Права на арт и лицензия Spine - см. выше.
