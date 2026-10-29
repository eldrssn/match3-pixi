import type { TBoardStep } from '@/entities/game';

/**
 * Типы-помощники по шагам протокола хода. Отдельным файлом без движка отрисовки: их
 * берут и реестр анимаций шагов (`modules/steps`), и события партии
 * (`model/boardEvents`), а тот входит в баррель `@/widgets/game`.
 */

/** Вид шага протокола хода: `swap`, `damage`, `settle`, ... */
export type TBoardStepType = TBoardStep['type'];

/** Шаг протокола по его виду. */
export type TBoardStepOf<T extends TBoardStepType> = Extract<TBoardStep, { type: T }>;
