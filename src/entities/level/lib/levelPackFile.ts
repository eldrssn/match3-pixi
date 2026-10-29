import {
  normalizeMinigameLevelConfig,
  validateMinigameLevelConfig,
  type IMinigameLevelConfig,
  type IMinigameLevelValidationOptions,
} from '@/entities/game';
import { isRecord } from '@/shared/lib/isRecord';
import { LEVEL_TEXTS } from '../texts';

/**
 * Пак уровней - нумерованная последовательность уровней со своим названием.
 * Номер уровня в паке («Уровень N») - его позиция и его `id` (1..N без дыр).
 */
export interface ILevelPack {
  /** Ключ пака: имя папки `entities/level/packs/<id>`, часть ключа прогресса. */
  id: string;
  title: string;
  levels: readonly IMinigameLevelConfig[];
}

/**
 * Пак одним файлом - то, что редактор выгружает кнопкой «Экспорт» и что
 * разработчик кладёт в репозиторий `npm run levels:import <file>`. В
 * репозитории тот же пак живёт папкой: `pack.json` (id и название) и уровни
 * отдельными `level_<n>_config.json`, чтобы правка одного уровня давала
 * читаемый diff.
 */
export interface ILevelPackFile {
  packFormatVersion: number;
  id: string;
  title: string;
  levels: IMinigameLevelConfig[];
}

/** Версия формата файла пака. Формат самих уровней версионируется отдельно. */
export const LEVEL_PACK_FILE_VERSION = 1;

/**
 * Id пака становится именем папки и частью ключа `localStorage`: только
 * строчная латиница, цифры, `-` и `_`, без пробелов и регистра, которые
 * по-разному переживают файловые системы.
 */
export const LEVEL_PACK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export const isLevelPackId = (value: string): boolean => LEVEL_PACK_ID_PATTERN.test(value);

/** Номера уровней пака заново по позиции: `id` обязан совпадать с ней. */
export const renumberPackLevels = (
  levels: readonly IMinigameLevelConfig[]
): IMinigameLevelConfig[] =>
  levels.map((level, index) => (level.id === index + 1 ? level : { ...level, id: index + 1 }));

/**
 * Ошибки пака: его id, название и каждый уровень с номером в сообщении.
 * `options` уходят в валидацию уровня (подписи элементов из скина).
 */
export const validateLevelPack = (
  pack: ILevelPack,
  options?: IMinigameLevelValidationOptions
): string[] => {
  const errors: string[] = [];

  if (!isLevelPackId(pack.id)) {
    errors.push(LEVEL_TEXTS.pack.idInvalid(pack.id));
  }

  if (pack.title.trim() === '') {
    errors.push(LEVEL_TEXTS.pack.noTitle);
  }

  if (pack.levels.length === 0) {
    errors.push(LEVEL_TEXTS.pack.noLevels);
  }

  pack.levels.forEach((level, index) => {
    const position = index + 1;

    if (level.id !== position) {
      errors.push(LEVEL_TEXTS.pack.levelIdMismatch(position, level.id));
    }

    validateMinigameLevelConfig(level, options).forEach((error) => {
      errors.push(LEVEL_TEXTS.pack.levelError(position, error));
    });
  });

  return errors;
};

export const toLevelPackFile = (pack: ILevelPack): ILevelPackFile => ({
  packFormatVersion: LEVEL_PACK_FILE_VERSION,
  id: pack.id,
  title: pack.title,
  levels: [...pack.levels],
});

export interface IParsedLevelPackFile {
  /** Пак после нормализации уровней; `null` - это не файл пака вовсе. */
  pack: ILevelPack | null;
  errors: string[];
}

/**
 * Файл пака из произвольного JSON. Уровни проходят ту же нормализацию, что
 * уровни каталога, а всё, что нормализация не чинит (битая клетка, id не по
 * позиции, лишний цвет цели), возвращается ошибками: импорт пака с ошибкой
 * не должен молча записать в репозиторий другой уровень, чем собирал автор.
 */
/**
 * Ошибки уровня файла до нормализации: не объект, нет поля или нет целей
 * нормализация молча заменила бы шаблонным уровнем, и импорт записал бы
 * уровень, которого автор не собирал.
 */
const listRawLevelErrors = (level: unknown, position: number): string[] => {
  if (!isRecord(level)) {
    return [LEVEL_TEXTS.pack.levelNotObject(position)];
  }

  const errors: string[] = [];

  if (!Array.isArray(level.grid) || level.grid.length === 0) {
    errors.push(LEVEL_TEXTS.pack.levelNoGrid(position));
  }

  if (!Array.isArray(level.levelGoals)) {
    errors.push(LEVEL_TEXTS.pack.levelNoGoals(position));
  }

  return errors;
};

export const parseLevelPackFile = (
  value: unknown,
  options?: IMinigameLevelValidationOptions
): IParsedLevelPackFile => {
  if (!isRecord(value) || !Array.isArray(value.levels)) {
    return { pack: null, errors: [LEVEL_TEXTS.pack.notPackFile] };
  }

  const version = Number(value.packFormatVersion);
  const errors: string[] = [];
  const levelErrors = value.levels.flatMap((level, index) => listRawLevelErrors(level, index + 1));

  if (!Number.isInteger(version) || version < 1 || version > LEVEL_PACK_FILE_VERSION) {
    errors.push(
      LEVEL_TEXTS.pack.unsupportedVersion(String(value.packFormatVersion), LEVEL_PACK_FILE_VERSION)
    );
  }

  const pack: ILevelPack = {
    id: typeof value.id === 'string' ? value.id.trim() : '',
    title: typeof value.title === 'string' ? value.title.trim() : '',
    levels: value.levels.map((level) =>
      normalizeMinigameLevelConfig(isRecord(level) ? (level as Partial<IMinigameLevelConfig>) : {})
    ),
  };

  return { pack, errors: [...errors, ...levelErrors, ...validateLevelPack(pack, options)] };
};
