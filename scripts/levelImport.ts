/**
 * Импорт пака из файла редактора в репозиторий:
 * `npm run levels:import <file> [-- --no-report]`.
 *
 * Файл - то, что редактор (`/editor`) выгружает кнопкой «Экспорт»
 * (`ILevelPackFile`: id, название и все уровни). Скрипт проверяет его тем же
 * правилом, что тест каталога (`parseLevelPackFile`), и при ошибках ничего не
 * пишет. Чистый файл раскладывается в `src/entities/level/packs/<id>/`:
 * `pack.json` и по `level_<n>_config.json` на уровень. Файлы уровней с
 * номерами за концом пака удаляются - иначе удалённый в редакторе уровень
 * вернулся бы в каталог. Затем печатается отчёт бота по паку
 * (`lib/packReport`, как `levels:report`); `RUNS=40` - точнее доли.
 *
 * После импорта стоит прогнать `npm run test:slow`: тест каталога держит
 * каждый уровень в полосе его роли в ритме пака.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { parseLevelPackFile } from '@/entities/level';
import { getElementLabel } from '@/entities/skin';
import { formatPackReport, readReportRuns } from './lib/packReport';

const PACKS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/entities/level/packs'
);
const LEVEL_FILE_PATTERN = /^level_(\d+)_config\.json$/;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const filePath = args.find((arg) => !arg.startsWith('--'));
const withReport = !args.includes('--no-report');

if (!filePath) {
  fail('Укажите файл пака: npm run levels:import <file>');
}

let raw: unknown;

try {
  raw = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
} catch (error) {
  fail(`Не удалось прочитать ${filePath}: ${(error as Error).message}`);
}

// Подписи элементов - из скина, как в редакторе: автор видит «Ящик», а не `cargo`.
const { pack, errors } = parseLevelPackFile(raw, { describeElement: getElementLabel });

if (!pack || errors.length > 0) {
  fail([`Пак не импортирован, ошибки в ${filePath}:`, ...errors.map((e) => `  - ${e}`)].join('\n'));
}

const packDir = path.join(PACKS_DIR, pack.id);
const isNewPack = !fs.existsSync(packDir);

/** JSON в стиле репозитория: тот же prettier, что у lint-staged. */
const writeJson = async (target: string, value: unknown) => {
  const options = (await prettier.resolveConfig(target)) ?? {};
  const text = await prettier.format(JSON.stringify(value), { ...options, filepath: target });

  fs.writeFileSync(target, text);
};

fs.mkdirSync(packDir, { recursive: true });
await writeJson(path.join(packDir, 'pack.json'), { id: pack.id, title: pack.title });

for (const level of pack.levels) {
  await writeJson(path.join(packDir, `level_${level.id}_config.json`), level);
}

const removed = fs
  .readdirSync(packDir)
  .filter((name) => Number(LEVEL_FILE_PATTERN.exec(name)?.[1] ?? 0) > pack.levels.length);

removed.forEach((name) => fs.rmSync(path.join(packDir, name)));

console.log(
  [
    `${isNewPack ? 'Новый пак' : 'Пак обновлён'}: ${path.relative(process.cwd(), packDir)}`,
    `  уровней: ${pack.levels.length}`,
    ...(removed.length > 0 ? [`  удалены лишние файлы: ${removed.join(', ')}`] : []),
  ].join('\n')
);

if (withReport) {
  console.log(`\n${formatPackReport(pack, readReportRuns())}`);
}
