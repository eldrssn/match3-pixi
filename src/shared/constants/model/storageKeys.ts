/**
 * Все ключи `localStorage` приложения - под одним префиксом и в одном месте:
 * копия шаблона, живущая на общем origin с другой игрой, меняет только
 * `STORAGE_PREFIX`. Смена префикса (или версии в ключе) обнуляет сохранённое
 * у игроков - прогресс в том числе, поэтому у выпущенной игры его не трогают.
 *
 * | Ключ                               | Владелец                                     |
 * | ---------------------------------- | -------------------------------------------- |
 * | `match3-pixi:progress:v1`          | прогресс пака по умолчанию (`levelProgress`) |
 * | `match3-pixi:progress:<packId>:v1` | прогресс остальных паков                     |
 * | `match3-pixi:sound-muted`          | выключенный звук (`widgets/game/audio`)      |
 * | `match3-pixi:editor-workspace:v1`  | черновики паков редактора                    |
 * | `match3-pixi:editor-columns:v1`    | ширины колонок редактора                     |
 */
export const STORAGE_PREFIX = 'match3-pixi';

export const STORAGE_KEYS = {
  /** Пак по умолчанию - на ключе без id пака, как у исходного Phaser-шаблона. */
  defaultPackProgress: `${STORAGE_PREFIX}:progress:v1`,
  packProgress: (packId: string) => `${STORAGE_PREFIX}:progress:${packId}:v1`,
  soundMuted: `${STORAGE_PREFIX}:sound-muted`,
  editorWorkspace: `${STORAGE_PREFIX}:editor-workspace:v1`,
  editorColumnWidths: `${STORAGE_PREFIX}:editor-columns:v1`,
} as const;
