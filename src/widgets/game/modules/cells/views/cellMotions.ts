import { BOARD_TIMING } from '../../../configs/timing';
import { tweenDisplay } from '../../../motion/displayMotion';
import type { ICellDestroyContext } from './cellView';

/**
 * Замах перед схлопыванием: удар читается как «замах - действие - импакт», а
 * не как мгновенное исчезновение спрайта.
 */
const DESTROY_ANTICIPATION_SCALE = 1.2;

/**
 * Разрушение фишки по умолчанию: замах, сноп частиц и схлопывание в точку.
 *
 * Замах помещается ВНУТРЬ барьера перед падением
 * (`BOARD_TIMING.destroy.barrierMs`), а не добавляется к нему: к старту
 * гравитации фишка обязана быть уже сжатой, иначе соседка въедет в клетку, где
 * прежняя ещё стоит на полный рост. Частицы - в момент схлопывания, а не
 * замаха: импакт и его частицы должны совпасть.
 */
export const collapseMotion = async ({
  motion,
  display,
  baseScale,
  burst,
}: ICellDestroyContext): Promise<void> => {
  await tweenDisplay(
    motion,
    display,
    { scale: baseScale * DESTROY_ANTICIPATION_SCALE },
    { duration: BOARD_TIMING.destroy.anticipationMs, ease: 'Quad.easeOut' }
  );

  burst();

  await tweenDisplay(
    motion,
    display,
    { scale: 0, alpha: 0 },
    { duration: BOARD_TIMING.destroy.collapseMs, ease: 'Back.easeIn' }
  );
};

/**
 * Спецфишка гаснет вспышкой частиц сразу, без твина: её собственная анимация -
 * это взрыв, который уже отыграл шаг `detonate`. Синхронно - спрайт снимается
 * в том же ударе.
 */
export const burstMotion = ({ burst }: ICellDestroyContext): void => {
  burst();
};
