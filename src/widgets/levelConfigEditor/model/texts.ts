import { pluralizeRu } from '@/shared/lib/format';

/*
 * Все тексты интерфейса редактора уровней - здесь: заголовки, подписи,
 * aria-label, подсказки, тосты и формы слов. Копия шаблона правит
 * формулировки в этом файле, не трогая компоненты. Подписи и описания
 * элементов сюда не входят - они в скине (`@/entities/skin`).
 */

const ERROR_FORMS = ['ошибка', 'ошибки', 'ошибок'] as const;
const COLOR_FORMS = ['цвет', 'цвета', 'цветов'] as const;

const errorCount = (count: number) => `${count} ${pluralizeRu(count, ERROR_FORMS)}`;
const colorCount = (count: number) => `${count} ${pluralizeRu(count, COLOR_FORMS)}`;

export const EDITOR_TEXTS = {
  labels: {
    errorForms: ERROR_FORMS,
    colorForms: COLOR_FORMS,
    errorCount,
    colorCount,
  },
  header: {
    title: 'Конфигуратор уровней',
    resetLevel: 'Сбросить уровень',
    apply: 'Применить',
    settingsAria: 'Настройки уровня',
    settingsSplitter: 'Ширина настроек',
    workspaceAria: 'Поле и палитра',
    errorsAria: 'Ошибки конфигурации',
    previewSplitter: 'Ширина превью',
    previewPaneAria: 'Игра',
  },
  basics: {
    title: 'Основные настройки',
    levelTitle: 'Название',
    levelTitlePlaceholder: 'Без названия - только номер',
    moves: 'Ходы',
    cols: 'Колонки',
    rows: 'Строки',
    colors: 'Цвета фишек',
    colorUsage: (count: number, total: number, min: number) =>
      `${count} из ${total} · минимум ${min}`,
    colorToggle: (label: string, isActive: boolean) =>
      `${label}: ${isActive ? 'есть на уровне' : 'нет на уровне'}`,
    colorsMissing: (missing: number) =>
      `Включите ещё ${colorCount(missing)}: на одном цвете любой свап - готовая линия, и выбирать ход незачем.`,
    colorsMinimal:
      'Два цвета - крайний случай: добор почти после каждого хода сам собирает линии, уровень играет себя каскадами.',
    colorsHint:
      'Какие фишки есть на уровне: из них падают новые фишки, выбирается цвет «?» и собирают поле генераторы. Чем меньше цветов, тем чаще каскады и легче уровень.',
  },
  gridSize: {
    decrease: (label: string) => `${label}: меньше`,
    increase: (label: string) => `${label}: больше`,
  },
  pack: {
    title: 'Пак уровней',
    select: 'Пак',
    newSuffix: ' · новый',
    draftSuffix: ' · изменён',
    packTitle: 'Название',
    packId: 'Id (папка)',
    repoIdTitle: 'Id пака из репозитория - его папка и ключ прогресса игроков',
    export: 'Экспорт',
    import: 'Импорт…',
    create: 'Новый пак',
    discardConfirm: 'Точно? Ещё раз',
    discardToRepo: 'Откатить к репозиторию',
    remove: 'Удалить пак',
    fileInput: 'Файл пака',
    draftStoredHint: 'Правки хранятся в этом браузере.',
    errorsSummary: (count: number) => `В паке ${errorCount(count)} - импорт его не примет`,
  },
  levelList: {
    aria: 'Уровни пака',
    title: 'Уровни',
    add: 'Добавить',
    duplicate: 'Дублировать',
    moveUp: (levelNumber: number) => `Уровень ${levelNumber} выше`,
    moveDown: (levelNumber: number) => `Уровень ${levelNumber} ниже`,
    remove: 'Удалить',
    removeConfirm: (levelNumber: number) => `Удалить ${levelNumber}? Ещё раз`,
    level: (levelNumber: number) => `Уровень ${levelNumber}`,
    levelSummary: (levelNumber: number, size: string, moves: string, colors: number) =>
      `Уровень ${levelNumber} · ${size} · ${moves} · ${colorCount(colors)}`,
    untitled: 'без названия',
  },
  goals: {
    title: 'Цели уровня',
    element: 'Элемент',
    count: 'Кол-во',
    add: 'Добавить',
    remove: 'Удалить цель',
  },
  stars: {
    title: 'Звёзды за очки',
    hint: '1★ - за победу. 2★ и 3★ - если к концу победной партии набрано столько очков.',
    twoStars: '2★ от, очков',
    threeStars: '3★ от, очков',
    disabled: 'Выключены: победа засчитывается без звёзд, под доской - «Очки: N».',
  },
  grid: {
    aria: 'Поле уровня',
    toolHintPrefix: 'Инструмент: ',
    toolHintSuffix: ' · ЛКМ - поставить, зажать - кистью, ПКМ - стереть',
  },
  gridActions: {
    undo: 'Отменить',
    redo: 'Повторить',
    regenerateChips: 'Перегенерировать фишки',
    regenerateChipsTitle:
      'Новые цвета только обычным фишкам: дыры, блокеры, накладки и хэлперы остаются',
    generate: 'Сгенерировать с нуля',
    generateTitle: 'Новое поле под цели уровня - всё расставленное заменится',
    randomize: 'Фишки в «?»',
    clear: 'Очистить поле',
  },
  palette: {
    aria: 'Палитра элементов',
  },
  toolCard: {
    aria: 'Описание элемента',
    hovered: 'Наведено',
    selected: 'Выбрано',
    origin: (origin: string) => `Рождается из: ${origin}`,
  },
  tools: {
    groups: {
      chips: 'Фишки',
      helpers: 'Хэлперы',
      blockers: 'Блокеры',
      tools: 'Инструменты',
    },
    eraser: {
      label: 'Ластик',
      layerLabel: 'Инструмент',
      description:
        'Снимает верхний слой клетки: накладку, затем предмет, затем подложку. Правый клик стирает любым инструментом.',
    },
    emptyCell: 'Пусто',
    cellInfoIdle: 'Наведите на клетку, чтобы увидеть её состав',
    overlayRefusal: (label: string) => `${label} ложится только на фишку`,
    floorRefusal: 'Под дырой подложки не бывает',
  },
  bot: {
    title: 'Проверка ботом',
    intro: (runs: number) =>
      `Бот сыграет уровень ${runs} раз как обычный игрок и ${runs} раз как сильный: видно, проходим ли уровень и насколько он сложный.`,
    run: 'Проверить уровень',
    running: (done: number, total: number) => `Играю: ${done} из ${total}`,
    invalid: 'Сначала исправьте ошибки уровня - бот играет только валидное поле.',
    stale: 'Черновик изменился - проверьте заново.',
    difficulty: 'Сложность: ',
    tooHard: (minPercent: number) =>
      `Обычный игрок выигрывает реже ${minPercent}% партий - в пак такой уровень не пройдёт тест каталога.`,
    casualPlayer: 'Обычный игрок',
    casualPlayerNote: ' (лучший ход примерно через раз):',
    greedyPlayer: 'Сильный игрок',
    greedyPlayerNote: ' (всегда лучший ход):',
    starSuggestion: (twoStars: string, threeStars: string) =>
      `Звёзды по очкам обычного игрока: 2★ от ${twoStars}, 3★ от ${threeStars}`,
    starsApplied: 'Эти пороги уже стоят в уровне.',
    applyStars: 'Подставить эти пороги',
    difficultyLevels: {
      easy: 'лёгкий',
      normal: 'обычный',
      hard: 'сложный',
      impossible: 'почти непроходимый',
    },
    noWins: (runs: number) => `ни одной победы из ${runs}`,
    wins: (wins: number, runs: number, movesLeft: string) =>
      `выиграл ${wins} из ${runs}, в среднем осталось ${movesLeft} хода`,
  },
  preview: {
    aria: 'Превью уровня',
    boosters: 'Бустеры',
    tutorial: 'Подсказки механик',
    offersContinue: (extraMoves: number) => `+${extraMoves} ходов на исходе`,
    debug: 'Кнопки исхода',
    preBoostersAria: 'Предуровневые бустеры',
    preBoosters: 'Перед уровнем',
    seed: 'Зерно',
    seedPlaceholder: 'случайное',
    restart: 'Заново',
    victory: 'Победа',
    defeat: 'Поражение',
    score: (score: string) => `${score} очков`,
    noStars: 'без звёзд',
    starFilled: '★',
    starEmpty: '☆',
    emptyTitle: 'Уровень не применён',
    emptyText: 'В черновике уровня есть ошибки: исправьте их и нажмите «Применить».',
    exitedTitle: 'Партия закрыта',
    exitedText: 'Кнопка выхода в игре ведёт хоста на главную; здесь - «Заново».',
    failedText: 'Подробности сбоя - в консоли. Поправьте уровень и нажмите «Заново».',
    outOfMoves: 'Ходы кончились',
    goalsLeftAria: 'Осталось собрать',
    giveUp: 'Сдаться',
  },
  json: {
    aria: 'JSON уровня',
    title: 'JSON',
    copy: 'Скопировать',
    download: 'Скачать',
  },
  workspace: {
    newPackTitle: 'Новый пак',
  },
  toasts: {
    fixJson: 'Исправьте JSON перед запуском превью',
    fixErrors: 'Проверьте ошибки конфигурации',
    applied: 'Конфигурация применена к игре',
    generatedNoMove: 'Поле сгенерировано, но хода на нём нет - уменьшите количество блокеров',
    generatedSkippedGoals: (cells: number) =>
      `Поле сгенерировано, но ${cells} клеток под цели не поместились`,
    generated: 'Поле сгенерировано',
    chipsRegenerated: 'Фишки перегенерированы, остальное на месте',
    chipsRegeneratedNoMove:
      'Фишки перегенерированы, но хода на поле нет - освободите место у блокеров',
    chipsRandomized: 'Фишки стали клетками «?»: цвета выберет партия',
    levelReset: 'Уровень сброшен к шаблону',
    levelAdded: (levelNumber: number) => `Уровень ${levelNumber} добавлен`,
    levelDuplicated: (from: number, to: number) => `Уровень ${from} скопирован в ${to}`,
    lastLevel: 'В паке должен остаться хотя бы один уровень',
    levelRemoved: (levelNumber: number) => `Уровень ${levelNumber} удалён, номера сдвинулись`,
    packIdTaken: (id: string) => `Id «${id}» уже занят или пак есть в репозитории`,
    packIdInvalid: (id: string) =>
      `Id «${id}» не подходит: латиница в нижнем регистре, цифры, «-» и «_», до 32 знаков`,
    packCreated: 'Создан новый пак',
    packReverted: 'Пак возвращён к версии репозитория',
    packRemoved: 'Пак удалён',
    packExportedWithErrors: (errors: number) =>
      `Пак выгружен, но в нём ${errorCount(errors)}: levels:import его не примет`,
    packExported: (fileName: string) => `Пак выгружен: ${fileName}`,
    fileUnreadable: (message: string) => `Файл не прочитан: ${message}`,
    notPackFile: 'Это не файл пака',
    packImportedWithErrors: (title: string, errors: number) =>
      `Пак «${title}» загружен, но в нём ${errorCount(errors)}`,
    packImported: (title: string) => `Пак «${title}» загружен в черновик`,
    jsonCopied: 'JSON скопирован',
    jsonCopyFailed: 'Не удалось скопировать JSON',
  },
} as const;
