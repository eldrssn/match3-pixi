/**
 * Сводка сложности паков ботом-солвером: `npm run levels:report`.
 *
 * Играет каждый уровень каждого пака `src/entities/level/packs` двумя
 * моделями игрока и печатает таблицу (`lib/packReport`). Ничего не пишет -
 * править уровень удобнее в редакторе (`/editor`, секция «Проверка ботом»).
 *
 * `RUNS=40 npm run levels:report` - больше партий на уровень, точнее доли;
 * `PACK=main npm run levels:report` - только один пак.
 */
import { LEVEL_PACKS } from '@/entities/level';
import { formatPackReport, readReportRuns } from './lib/packReport';

const runs = readReportRuns();
const packId = process.env.PACK;
const packs = packId ? LEVEL_PACKS.filter((pack) => pack.id === packId) : LEVEL_PACKS;

if (packs.length === 0) {
  console.error(`Пака «${packId}» нет в src/entities/level/packs.`);
  process.exit(1);
}

console.log(packs.map((pack) => formatPackReport(pack, runs)).join('\n\n'));
