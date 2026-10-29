import type { ISkinManifest } from '../../model/types';

/**
 * Темп доски поверх значений рантайма (`widgets/game/configs/timing.ts`):
 * любые группы и любые числа внутри них, остальное - по умолчанию. Скин по
 * умолчанию идёт темпом рантайма и ничего не переопределяет.
 *
 * Пример - тяжелее падение и медленнее свап:
 *
 * ```ts
 * fall: { baseMs: 180, perRowMs: 70 },
 * swap: { durationMs: 260 },
 * ```
 */
export const DEFAULT_TIMING: ISkinManifest['timing'] = {};
