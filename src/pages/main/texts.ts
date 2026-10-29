/**
 * Все тексты главной примера хоста (кнопки, карта уровней, витрина) - в одном
 * месте: копия шаблона меняет формулировки здесь. Тексты карточек - в
 * `@/widgets/modals` (`MODAL_TEXTS`), экрана партии - в `@/widgets/game`
 * (`GAME_RUNTIME_FAILURE_TEXT`), названия уровней витрины - в её каталоге.
 */
export const MAIN_TEXTS = {
  title: 'Match-3',
  actions: {
    play: (levelNumber: number) => `Играть · уровень ${levelNumber}`,
    map: 'Уровни',
    showcase: 'Витрина',
    editor: 'Редактор',
  },
  back: 'Назад',
  map: {
    title: 'Уровни',
    levelLabel: (level: number, stars: number | null) =>
      `Уровень ${level}${stars === null ? '' : `, звёзд: ${stars} из 3`}`,
    lockedLevelLabel: (level: number) => `Уровень ${level} закрыт`,
    reset: 'Сбросить прогресс',
    resetConfirm: 'Точно сбросить? Нажмите ещё раз',
  },
  showcase: {
    title: 'Витрина',
    /** Подпись под доской в партии витрины. */
    partyTitle: (title: string) => `Витрина · ${title}`,
  },
} as const;
