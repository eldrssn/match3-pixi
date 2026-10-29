/**
 * Все тексты модалок примера хоста (карточка уровня, near-miss, победа,
 * поражение) - в одном месте: копия шаблона меняет формулировки здесь.
 * Подписи и иконки предуровневых бустеров - описание спецфишки в скине
 * (`@/entities/skin`), не здесь.
 */
export const MODAL_TEXTS = {
  levelStart: {
    title: (levelNumber: number | undefined) => `Уровень ${levelNumber ?? ''}`,
    /** `moves` - уже отформатированное «N ходов». */
    description: (moves: string) => `Соберите за ${moves}:`,
    boostersTitle: 'Взять с собой',
    play: 'Играть',
  },
  outOfMoves: {
    title: 'Ещё чуть-чуть!',
    description: 'Ходы закончились. Осталось собрать:',
    /** `moves` - уже со словоформой: «5 ходов». */
    continue: (moves: string) => `+${moves}`,
    giveUp: 'Сдаться',
  },
  victory: {
    title: 'Победа!',
    description: 'Уровень пройден. Так держать!',
  },
  defeat: {
    title: 'Ходы закончились',
    description: 'Но упорство всегда вознаграждается. Попробуйте ещё раз',
  },
  result: {
    starsLabel: (stars: number) => `Звёзд: ${stars} из 3`,
    score: (score: string) => `Очки: ${score}`,
    next: 'Дальше',
    retry: 'Ещё раз',
    goHome: 'На главную',
  },
} as const;
