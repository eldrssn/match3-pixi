/**
 * Чистые правила шапки партии (`modules/MovesCounter`, `GameGoalsPannel`,
 * `ScoreMeter`, кнопки бустеров, `IdleBreathing`) - без Pixi, чтобы их можно
 * было проверить тестом. Числа и пороги - те же, что у Phaser-эталона.
 */

/** С какого остатка ходов счётчик начинает тревожиться цветом. */
export const LOW_MOVES_THRESHOLD = 3;

/**
 * Цвет цифры счётчика - производная от значения, а не эффект списания: он
 * обязан быть верным и на старте уровня с тремя ходами.
 */
export const resolveMovesColor = (moves: number, normal: string, low: string): string =>
  moves <= LOW_MOVES_THRESHOLD ? low : normal;

/**
 * Места иконок целей по X в контейнере панели: шаг `spacing`, ряд по центру.
 */
export const resolveGoalSlotsX = (count: number, spacing: number): number[] => {
  const centerOffset = ((count - 1) * spacing) / 2;

  return Array.from({ length: count }, (_, index) => index * spacing - centerOffset);
};

export interface IBoosterButtonState {
  /** Кнопка со счётчиком видна (партия с бустерами). */
  isVisible: boolean;
  /** Кнопка принимает тап. */
  isInteractive: boolean;
  /** Притушена: остаток кончился. */
  isDimmed: boolean;
}

/**
 * Состояние кнопки бустера по остатку и правилу партии
 * (`areBoostersHiddenForParty`): скрытая кнопка не рисуется и не кликается,
 * пустая притушена и тоже не кликается.
 */
export const resolveBoosterButtonState = (
  quantity: number,
  isHiddenForParty: boolean
): IBoosterButtonState => ({
  isVisible: !isHiddenForParty,
  isInteractive: !isHiddenForParty && quantity > 0,
  isDimmed: quantity === 0,
});

export interface IStarFlagsInput {
  isGameEnded: boolean;
  isGameWin: boolean;
  score: number;
}

/**
 * Какие из трёх звёзд шкалы очков горят: первая - только за закрытые цели
 * (победа), вторая и третья - по порогам очков уровня и до победы: это
 * прогресс, к которому игрок тянется.
 */
export const resolveLitStars = (
  { isGameEnded, isGameWin, score }: IStarFlagsInput,
  [two, three]: readonly [number, number]
): [boolean, boolean, boolean] => [isGameEnded && isGameWin, score >= two, score >= three];

/** Пауза между вдохами доски, мс: целое из `[min, max]` (`Phaser.Math.Between` эталона). */
export const pickBreathDelayMs = (min: number, max: number, random: () => number): number =>
  min + Math.floor(random() * (max - min + 1));

/**
 * Точки пятиконечной звезды шкалы очков вокруг её центра: десять вершин,
 * внешний и внутренний радиус по очереди, первая - вверх.
 */
export const resolveStarPoints = (outer: number, inner: number): number[] => {
  const points: number[] = [];

  for (let index = 0; index < 10; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;

    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  return points;
};
