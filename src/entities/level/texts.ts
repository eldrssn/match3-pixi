/**
 * Тексты слоя уровней - в одном месте: ошибки файла и состава пака (их
 * показывают редактор и `levels:import`). Названия и подписи уровней витрины - данные её каталога
 * (`model/showcaseCatalog`), а не здесь.
 */
export const LEVEL_TEXTS = {
  pack: {
    idInvalid: (id: string) =>
      `Id пака «${id}»: строчная латиница, цифры, «-» и «_», до 32 символов, с буквы или цифры.`,
    noTitle: 'У пака нет названия.',
    noLevels: 'В паке нет ни одного уровня.',
    levelIdMismatch: (position: number, id: number) =>
      `Уровень ${position}: id ${id}, а должен совпадать с позицией в паке.`,
    levelError: (position: number, error: string) => `Уровень ${position}: ${error}`,
    levelNotObject: (position: number) => `Уровень ${position}: это не объект уровня.`,
    levelNoGrid: (position: number) => `Уровень ${position}: нет поля \`grid\` или оно пустое.`,
    levelNoGoals: (position: number) => `Уровень ${position}: нет списка целей \`levelGoals\`.`,
    notPackFile: 'Это не файл пака: нет списка уровней `levels`.',
    unsupportedVersion: (version: string, expected: number) =>
      `Версия файла пака ${version} не поддерживается (ожидается ${expected}).`,
  },
} as const;
