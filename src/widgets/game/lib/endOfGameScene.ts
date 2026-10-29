import { BOARD_TIMING } from '../configs/timing';
import type { IBoardBounds, IBoardFx } from '../fx/boardFx';
import type { RuntimeMotion } from '../motion/RuntimeMotion';

/**
 * Финальная сцена на доске: то, что игрок видит между принятым исходом и
 * модалкой результата.
 *
 * Лежит в `lib/`, а не методом `GameLogic`: «как выглядит концовка» - это
 * композиция готовых эффектов доски (`IBoardFx`), которой грид и стор не
 * нужны. `GameLogic` остаётся владельцем момента (когда играть и когда
 * поднять `isFinaleFinished`), а не самой картинки.
 *
 * Промис ждут: пока сцена идёт, доска занята, а React-слой держит исход -
 * модалка не должна выскакивать поверх кульминации.
 */
export interface IEndOfGameScene extends IBoardBounds {
  /** Победа - вспышка и толчок, поражение - толчок и затемнение. */
  isWin: boolean;
}

export const playEndOfGameScene = async (
  motion: RuntimeMotion,
  fx: IBoardFx,
  { isWin, colCount, rowCount }: IEndOfGameScene
): Promise<void> => {
  if (isWin) {
    fx.flashBoard();
    fx.punchCamera('shockwave');
    // Вспышка и толчок не ждутся, поэтому финал держит модалку ровно на их
    // длину: без паузы карточка победы приходила бы в тот же кадр, что и
    // вспышка, и съедала бы её.
    await motion.delay(BOARD_TIMING.fx.winBeatMs);

    return;
  }

  fx.punchCamera('defeat');
  await fx.dimBoard({ colCount, rowCount });
};
