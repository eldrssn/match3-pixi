import { measureLevelWithBot, suggestStarScores } from '@/entities/game';
import type { ILevelPack } from '@/entities/level';

const percent = (share: number) => `${Math.round(share * 100)}%`.padStart(4);

/**
 * Таблица сложности пака ботом-солвером: каждый уровень играется двумя
 * моделями игрока (`entities/game/bot`) - ходы, доля
 * побед и запас ходов сильного и обычного игрока, пороги звёзд уровня и
 * пороги, которые предложил бы бот. Общая для `levels:report` и
 * `levels:import`: импортированный пак проверяется тем же отчётом.
 */
export const formatPackReport = (pack: ILevelPack, runs: number): string => {
  const rows = pack.levels.map((level) => {
    const greedy = measureLevelWithBot(level, { runs });
    const casual = measureLevelWithBot(level, { runs, strategy: 'casual' });
    const suggested = suggestStarScores(casual.winScores);

    return [
      String(level.id).padStart(2),
      (level.title || '-').padEnd(18),
      `${level.grid.length}×${level.grid[0]?.length ?? 0}`,
      String(level.moves).padStart(3),
      percent(casual.winRate),
      casual.avgMovesLeftOnWin.toFixed(1).padStart(5),
      percent(greedy.winRate),
      greedy.avgMovesLeftOnWin.toFixed(1).padStart(5),
      String(greedy.maxEmptyCells).padStart(3),
      (level.starScores?.join('/') ?? '-').padEnd(13),
      suggested ? suggested.join('/') : '-',
    ].join('  ');
  });

  return [
    `Пак «${pack.title}» (${pack.id}): ${pack.levels.length} уровней, ${runs} партий на модель игрока`,
    ' #  название            поле  ход  обыч  запас  сильн запас пуст  звёзды         бот',
    ...rows,
  ].join('\n');
};

const DEFAULT_REPORT_RUNS = 20;

/**
 * Партий на модель игрока: `RUNS=40` - точнее доли, дольше отчёт. Не целое
 * положительное (`RUNS=abc`, `RUNS=0`) - по умолчанию, а не `NaN` партий.
 */
export const readReportRuns = (): number => {
  const runs = Number(process.env.RUNS);

  return Number.isInteger(runs) && runs > 0 ? runs : DEFAULT_REPORT_RUNS;
};
