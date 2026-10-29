import { beforeAll, describe, expect, it } from 'vitest';
import { measureLevelWithBot, type ILevelBotReport } from '@/entities/game';
import type { IMinigameLevelConfig } from '@/entities/game';
import { LEVEL_PACKS } from './levelCatalog';
import { LEVEL_DIFFICULTY_WIN_RATE } from './levelDifficulty';

/**
 * Проверка каталога ботом-солвером (`entities/game/bot`): каждый уровень
 * играется на чистом движке теми же правилами, что в партии, на фиксированных
 * зёрнах - результат воспроизводим и не зависит от машины.
 *
 * Две модели игрока: `greedy` видит лучший ход на каждом шаге (сильнее
 * человека) и ловит сломанный уровень - его не проходит даже он; `casual`
 * находит лучший ход через раз и ловит слишком сложный уровень - он должен
 * проходить его хотя бы на ступени «сложный» шкалы `levelDifficulty`.
 */
const GREEDY_RUNS = 8;
const CASUAL_RUNS = 12;
/** Полсотни партий бота на каждый уровень каталога - не десять секунд. */
const MEASURE_TIMEOUT_MS = 120_000;

interface ILevelReports {
  level: IMinigameLevelConfig;
  greedy: ILevelBotReport;
  casual: ILevelBotReport;
}

describe('levelCatalog: бот', () => {
  /** Ключ - «пак/номер»: так же он читается в сообщении упавшей проверки. */
  const reports = new Map<string, ILevelReports>();

  beforeAll(() => {
    LEVEL_PACKS.forEach((pack) => {
      pack.levels.forEach((level) => {
        reports.set(`${pack.id}/${level.id}`, {
          level,
          greedy: measureLevelWithBot(level, { runs: GREEDY_RUNS }),
          casual: measureLevelWithBot(level, { runs: CASUAL_RUNS, strategy: 'casual' }),
        });
      });
    });
  }, MEASURE_TIMEOUT_MS * LEVEL_PACKS.length);

  const each = (check: (id: string, report: ILevelReports) => void) => {
    reports.forEach((report, id) => check(id, report));
  };

  it('поле не высыхает: пустых клеток на устоявшейся доске нет (добор на месте)', () => {
    each((id, { greedy }) => {
      expect(greedy.maxEmptyCells, `level ${id}`).toBe(0);
    });
  });

  it('партия не кончается тупиком без перемешки', () => {
    each((id, { greedy, casual }) => {
      expect(greedy.stuckRate, `level ${id}`).toBe(0);
      expect(casual.stuckRate, `level ${id}`).toBe(0);
    });
  });

  it('жадный бот проходит каждый уровень хотя бы в половине партий', () => {
    each((id, { greedy }) => {
      expect(greedy.winRate, `level ${id}`).toBeGreaterThanOrEqual(0.5);
    });
  });

  it('обычный игрок проходит уровень не реже порога «сложный»', () => {
    each((id, { casual }) => {
      expect(casual.winRate, `level ${id}`).toBeGreaterThanOrEqual(LEVEL_DIFFICULTY_WIN_RATE.hard);
    });
  });
});
