import { normalizeMinigameLevelConfig, type IMinigameLevelConfig } from '@/entities/game';

/**
 * Витрина: по уровню на каждый предмет игры - блокер, спецфишку и комбинацию
 * двух спецфишек. Это не пак: ни прогресса, ни бот-проверки сложности
 * (`LEVEL_DIFFICULTY_WIN_RATE`) - уровень витрины показывает одну механику, и
 * хост играет его вне прогресса игрока.
 *
 * Уровни - JSON того же формата, что каталог (`showcase/showcase_<key>.json`):
 * поле из «?», а то, ради чего уровень, стоит фиксированно - блокеры, фишки
 * фигуры, которая собирается одним свапом, или пара спецфишек в центре поля
 * (палитра редактора спецфишек не ставит, такие уровни пишутся руками).
 * Порядок витрины задаёт таблица ниже, а не имена файлов.
 */
export type TShowcaseGroup = 'blockers' | 'specials' | 'combos';

export const SHOWCASE_GROUP_TITLES: Readonly<Record<TShowcaseGroup, string>> = {
  blockers: 'Блокеры',
  specials: 'Спецфишки',
  combos: 'Комбинации',
};

export const SHOWCASE_GROUPS: readonly TShowcaseGroup[] = ['blockers', 'specials', 'combos'];

interface IShowcaseEntry {
  /** Имя файла уровня: `showcase_<key>.json`. */
  key: string;
  group: TShowcaseGroup;
  title: string;
  /** Одна строка в списке витрины: что делает предмет. */
  hint: string;
}

const SHOWCASE_ENTRIES: readonly IShowcaseEntry[] = [
  { key: 'ice', group: 'blockers', title: 'Лёд', hint: 'Держит фишку, тает за 2 удара' },
  { key: 'chain', group: 'blockers', title: 'Цепь', hint: 'Фишка матчится, но не двигается' },
  { key: 'cargo', group: 'blockers', title: 'Ящик', hint: '1-3 слоя, бьётся матчем рядом' },
  { key: 'stone', group: 'blockers', title: 'Камень', hint: 'Только спецфишки и бустеры' },
  { key: 'slime', group: 'blockers', title: 'Слизь', hint: 'Растёт, если её не задеть ходом' },
  { key: 'drop', group: 'blockers', title: 'Опусти вниз', hint: 'Доведите до дна колонки' },
  { key: 'floor', group: 'blockers', title: 'Подложка', hint: 'Снимается матчем на клетке' },
  { key: 'hole', group: 'blockers', title: 'Дыры', hint: 'Фишки пролетают насквозь' },
  { key: 'rocket', group: 'specials', title: 'Ракета', hint: '4 в ряд: строка или колонка' },
  { key: 'bomb', group: 'specials', title: 'Бомба', hint: 'L или T: квадрат 3×3' },
  { key: 'propeller', group: 'specials', title: 'Пропеллер', hint: 'Квадрат 2×2: летит к цели' },
  { key: 'rainbow', group: 'specials', title: 'Радуга', hint: '5 в ряд: все фишки цвета' },
  { key: 'rocketRocket', group: 'combos', title: 'Ракета + ракета', hint: 'Крест' },
  { key: 'rocketBomb', group: 'combos', title: 'Ракета + бомба', hint: 'Три строки и три колонки' },
  { key: 'bombBomb', group: 'combos', title: 'Бомба + бомба', hint: 'Квадрат 5×5' },
  {
    key: 'propellerRocket',
    group: 'combos',
    title: 'Пропеллер + ракета',
    hint: 'Пропеллер несёт ракету к цели',
  },
  {
    key: 'propellerBomb',
    group: 'combos',
    title: 'Пропеллер + бомба',
    hint: 'Пропеллер несёт бомбу к цели',
  },
  {
    key: 'propellerPropeller',
    group: 'combos',
    title: 'Пропеллер + пропеллер',
    hint: 'Крест и три полёта',
  },
  {
    key: 'rainbowRocket',
    group: 'combos',
    title: 'Радуга + ракета',
    hint: 'Фишки цвета становятся ракетами',
  },
  {
    key: 'rainbowBomb',
    group: 'combos',
    title: 'Радуга + бомба',
    hint: 'Фишки цвета становятся бомбами',
  },
  {
    key: 'rainbowPropeller',
    group: 'combos',
    title: 'Радуга + пропеллер',
    hint: 'Фишки цвета улетают пропеллерами',
  },
  { key: 'rainbowRainbow', group: 'combos', title: 'Радуга + радуга', hint: 'Удар по всему полю' },
];

export interface IShowcaseLevel extends IShowcaseEntry {
  level: IMinigameLevelConfig;
}

const showcaseFiles = import.meta.glob<IMinigameLevelConfig>('../showcase/showcase_*_config.json', {
  eager: true,
  import: 'default',
});

const readShowcaseLevel = (key: string): IMinigameLevelConfig => {
  const config = showcaseFiles[`../showcase/showcase_${key}_config.json`];

  if (!config) {
    throw new Error(`Showcase level file is missing: ${key}`);
  }

  return normalizeMinigameLevelConfig(config);
};

export const SHOWCASE_LEVELS: readonly IShowcaseLevel[] = SHOWCASE_ENTRIES.map((entry) => ({
  ...entry,
  level: readShowcaseLevel(entry.key),
}));

export const getShowcaseLevel = (key: string): IShowcaseLevel | null =>
  SHOWCASE_LEVELS.find((entry) => entry.key === key) ?? null;

/** Следующий уровень витрины; после последнего - он же (как «Дальше» после финала пака). */
export const getNextShowcaseKey = (key: string): string => {
  const index = SHOWCASE_LEVELS.findIndex((entry) => entry.key === key);

  return SHOWCASE_LEVELS[Math.min(index + 1, SHOWCASE_LEVELS.length - 1)]?.key ?? key;
};
