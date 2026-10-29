import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@/shared/lib/random';
import { MINIGAME_CHIP_IDS } from '../lib/minigameLevelConfig';
import { BoardEngine } from './BoardEngine';

/**
 * Перф-гейт движка: ход разыгрывается синхронно, до анимации, и на слабом
 * Android каждая лишняя миллисекунда здесь - задержка между свайпом и
 * откликом. Бюджет щедрый (на порядок выше обычного), чтобы не мигать на
 * загруженном CI, но ловит алгоритмическую регрессию - квадрат вместо
 * линейного прохода в гравитации или каскаде.
 */
const MOVES = 300;
const BUDGET_MS = 6000;

describe('BoardEngine: перф-гейт', () => {
  it(`${MOVES} ходов с лучшей подсказкой на поле 9×9 укладываются в бюджет`, () => {
    const grid = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => ({ id: 'random' }))
    );
    const engine = BoardEngine.fromLevel(grid, {
      colors: [...MINIGAME_CHIP_IDS],
      random: createSeededRandom(7),
    });
    const startedAt = performance.now();

    for (let move = 0; move < MOVES; move++) {
      const best = engine.findBestMove();

      if (!best) {
        engine.resolveDeadEnd();
        continue;
      }

      engine.trySwap(best[0], best[1]);
      engine.resolveDeadEnd();
    }

    expect(performance.now() - startedAt).toBeLessThan(BUDGET_MS);
  });
});
