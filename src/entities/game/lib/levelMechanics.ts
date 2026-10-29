import type { IMinigameLevelConfig } from '../types';

/**
 * Механики-препятствия уровня - то, чему игрока учат при первой встрече
 * (обучение - тонкий контракт: хост решает, что игрок уже видел, виджет
 * показывает подсказку). Коды - те же, что у целей уровня.
 */
export const LEVEL_MECHANICS = [
  'cargo',
  'ice',
  'chain',
  'floor',
  'stone',
  'slime',
  'drop',
] as const;

export type TLevelMechanic = (typeof LEVEL_MECHANICS)[number];

export const isLevelMechanic = (value: string): value is TLevelMechanic =>
  (LEVEL_MECHANICS as readonly string[]).includes(value);

/**
 * Какие механики есть на поле уровня, в порядке `LEVEL_MECHANICS`: предмет
 * клетки, накладка или подложка.
 */
export const listLevelMechanics = (level: Pick<IMinigameLevelConfig, 'grid'>): TLevelMechanic[] => {
  const found = new Set<string>();

  for (const column of level.grid) {
    for (const cell of column) {
      found.add(cell.id);

      if (cell.overlay) {
        found.add(cell.overlay);
      }

      if (cell.floor) {
        found.add('floor');
      }
    }
  }

  return LEVEL_MECHANICS.filter((mechanic) => found.has(mechanic));
};
