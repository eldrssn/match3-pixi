import type { IGameStartBooster } from '@/entities/game';

/**
 * Бустеры, с которыми начинается партия (кроме первого уровня - его главная
 * ведёт без бустеров).
 *
 * Набор фиксированный, инвентарь между партиями не копится. Превью редактора
 * берёт тот же набор - у превью и партии один источник, и разойтись в наборе
 * они не могут.
 */
export const DEFAULT_LEVEL_BOOSTERS: IGameStartBooster[] = [
  { kind: 'ball', quantity: 3 },
  { kind: 'laser', quantity: 3 },
  { kind: 'beam', quantity: 3 },
];
