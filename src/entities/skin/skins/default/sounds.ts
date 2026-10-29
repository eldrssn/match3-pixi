import type { ISkinManifest } from '../../model/types';

/**
 * Звуки скина поверх рецептов рантайма (`widgets/game/audio/soundRecipes`):
 * ключ - событие (`TSoundCue`), значение - свой рецепт синтеза. Скин по
 * умолчанию звучит рецептами рантайма и ничего не переопределяет.
 *
 * Пример - мягче «отказ» хода:
 *
 * ```ts
 * reject: [{ wave: 'sine', frequency: 300, frequencyEnd: 220, attack: 0.01, duration: 0.12, gain: 0.1 }],
 * ```
 */
export const DEFAULT_SOUNDS: ISkinManifest['sounds'] = {};
