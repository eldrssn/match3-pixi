import { normalizeMinigameLevelConfig, type IMinigameLevelConfig } from '@/entities/game';
import type { ILevelPack } from '../lib/levelPackFile';

/**
 * Каталог паков уровней шаблона.
 *
 * Пак - папка `packs/<id>/`: `pack.json` (`{ id, title }`) и уровни
 * `level_<n>_config.json` в том формате, который отдаёт редактор. Папки
 * находятся сами (`import.meta.glob`): новый пак - новая папка, без
 * регистрации в коде. Так их и пишет `npm run levels:import <file>`.
 *
 * `id` уровня обязан совпадать с позицией в паке (1..N без дыр): номер
 * уровня в интерфейсе - это `id`, а не индекс, и расхождение означало бы,
 * что кнопка «Уровень N» запускает другой уровень. Инвариант проверяет тест.
 */
const packManifests = import.meta.glob<Partial<Pick<ILevelPack, 'id' | 'title'>>>(
  '../packs/*/pack.json',
  { eager: true, import: 'default' }
);

const levelFiles = import.meta.glob<IMinigameLevelConfig>('../packs/*/level_*_config.json', {
  eager: true,
  import: 'default',
});

/** Пак, который играет главная. */
export const DEFAULT_LEVEL_PACK_ID = 'main';

const PACK_FOLDER_PATTERN = /\/packs\/([^/]+)\//;

/** Папка пака по пути файла: она и есть id пака. */
export const readPackFolder = (path: string): string => PACK_FOLDER_PATTERN.exec(path)?.[1] ?? '';

const buildPack = (folder: string, title: string): ILevelPack => ({
  id: folder,
  title,
  levels: Object.entries(levelFiles)
    .filter(([path]) => readPackFolder(path) === folder)
    .map(([, config]) => normalizeMinigameLevelConfig(config))
    .sort((first, second) => first.id - second.id),
});

/** Все паки репозитория: пак главной первым, остальные по id. */
export const LEVEL_PACKS: readonly ILevelPack[] = Object.entries(packManifests)
  .map(([path, manifest]) => {
    const folder = readPackFolder(path);

    return buildPack(folder, typeof manifest.title === 'string' ? manifest.title : folder);
  })
  .sort((first, second) => {
    if (first.id === DEFAULT_LEVEL_PACK_ID) return -1;
    if (second.id === DEFAULT_LEVEL_PACK_ID) return 1;

    return first.id.localeCompare(second.id);
  });

/** Манифесты паков как есть - тест сверяет их `id` с именем папки. */
export const LEVEL_PACK_MANIFESTS: readonly { folder: string; id: unknown }[] = Object.entries(
  packManifests
).map(([path, manifest]) => ({ folder: readPackFolder(path), id: manifest.id }));

/** Файлы уровней как есть - тест сверяет номер в имени файла с `id`. */
export const LEVEL_FILE_IDS: readonly { path: string; id: unknown }[] = Object.entries(
  levelFiles
).map(([path, config]) => ({ path, id: config.id }));

export const getLevelPack = (packId: string): ILevelPack | null =>
  LEVEL_PACKS.find((pack) => pack.id === packId) ?? null;

/**
 * Пак главной. Без его папки - пустой пак: главная покажет отказ на «Играть»,
 * а не упадёт на импорте, и тест каталога назовёт причину.
 */
export const DEFAULT_LEVEL_PACK: ILevelPack = getLevelPack(DEFAULT_LEVEL_PACK_ID) ?? {
  id: DEFAULT_LEVEL_PACK_ID,
  title: '',
  levels: [],
};

/**
 * Уровень пака по номеру. Номер - тот, что видит игрок («Уровень N»). Нет
 * уровня с таким номером - `null`: пак конечен, и решение «что делать, когда
 * уровни кончились» - правило хоста партии, а не каталога.
 */
export const getPackLevel = (pack: ILevelPack, levelNumber: number): IMinigameLevelConfig | null =>
  pack.levels[levelNumber - 1] ?? null;

/**
 * Ведёт ли уровень звёзды: без порогов (`starScores`) победа засчитывается
 * без оценки - ни звёзд на карте, ни лучших звёзд на карточке.
 */
export const levelHasStars = (level: IMinigameLevelConfig | null): boolean =>
  Boolean(level?.starScores);
