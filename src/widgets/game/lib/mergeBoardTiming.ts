import type { IBoardTiming, TBoardTimingOverride } from '@/entities/skin';

/**
 * Темп доски скина поверх значений по умолчанию: глубокое слияние на две
 * ступени (группа -> число). Группа, которой в переопределении нет, берётся
 * целиком; число, которого нет, - из своей группы по умолчанию.
 *
 * Только конечные числа: `undefined` в частичной записи (`{ swap: { durationMs:
 * undefined } }`) или `NaN` из опечатки в формуле не должны превратить
 * длительность твина в «мгновенно» - такое значение молча пропускается.
 */
export const mergeBoardTiming = <T extends IBoardTiming>(
  defaults: T,
  override: TBoardTimingOverride | undefined
): T => {
  if (!override) {
    return defaults;
  }

  const merged: Record<string, Record<string, number>> = {};

  for (const [group, values] of Object.entries(defaults) as [string, Record<string, number>][]) {
    const patch = (override as Record<string, Record<string, number | undefined> | undefined>)[
      group
    ];
    const next = { ...values };

    for (const [key, value] of Object.entries(patch ?? {})) {
      if (key in values && typeof value === 'number' && Number.isFinite(value)) {
        next[key] = value;
      }
    }

    merged[group] = next;
  }

  return merged as unknown as T;
};
