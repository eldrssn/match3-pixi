import type { TStepAnimationOverrides } from './stepAnimationTypes';

/**
 * Свои анимации шагов хода - единственное место, где копия проекта меняет,
 * как доска показывает протокол движка (`TBoardStep`). Ключ - вид шага,
 * значение - `(context, step, playDefault)`:
 *
 * - позвать `playDefault()` и добавить своё поверх (вспышка, звук, тряска);
 * - не звать и заменить целиком - тогда грид спрайтов держит в такт движку
 *   сама анимация (`context.board`: `place`, `spawn`, `detach`, `vacate`).
 *
 * Чего здесь нет, играется по умолчанию (`defaultStepAnimations.ts`). Темп
 * (длительности и паузы) меняется не здесь, а в скине - `ISkinManifest.timing`.
 *
 * Пример - удар камеры (эффекты доски, `context.fx`) на каждом звене каскада
 * после второго:
 *
 * ```ts
 * export const STEP_ANIMATION_OVERRIDES: TStepAnimationOverrides = {
 *   matches: async (context, step, playDefault) => {
 *     await playDefault();
 *
 *     if (step.iteration > 2) {
 *       context.fx.punchCamera('strike');
 *     }
 *   },
 * };
 * ```
 */
export const STEP_ANIMATION_OVERRIDES: TStepAnimationOverrides = {};
