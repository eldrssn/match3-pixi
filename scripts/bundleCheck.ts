/**
 * Бюджет бандла: `npm run bundle:check` после `npm run build`.
 *
 * Читает сборку в `dist/` (сырой размер и gzip уровня 9, как в отчёте Vite)
 * и падает, если чанк вышел за бюджет или нарушена ленивость движка:
 *
 * - стартовый чанк - `index.html`: точка входа и её `modulepreload`, вместе
 *   со всем, что они импортируют статически; ни Pixi, ни GSAP, ни Spine в
 *   нём быть не должно (движок приезжает с ленивым `GameScreen`);
 * - `GameScreen`, `pixi`, `gsap` - ленивые чанки партии;
 * - `spine` - рантайм Spine, только динамическим импортом: экран партии
 *   статически его не тянет, и скин без вида `spine` его не качает.
 *
 * Бюджеты - с небольшим запасом над текущими размерами (фаза 5, см.
 * `docs/PLAN.md`). Вырос чанк осознанно - поднимите бюджет здесь же и
 * запишите причину в журнал плана.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = resolve(process.cwd(), 'dist');
const JS_DIR = join(DIST, 'assets/js');
const KB = 1000;

interface IBudget {
  /** Сырой размер, КБ. */
  raw: number;
  /** gzip, КБ. */
  gzip: number;
}

/** Стартовый чанк: точка входа и предзагрузки `index.html`. */
const START_BUDGET: IBudget = { raw: 500, gzip: 155 };

/** Чанки по имени (`assets/js/<name>-<hash>.js`); `optional` - может не родиться. */
const CHUNK_BUDGETS: Record<string, IBudget & { optional?: boolean }> = {
  GameScreen: { raw: 165, gzip: 52 },
  pixi: { raw: 645, gzip: 188 },
  gsap: { raw: 75, gzip: 30 },
  spine: { raw: 228, gzip: 68, optional: true },
  spineRuntime: { raw: 4, gzip: 2, optional: true },
};

/** Чанки движка: стартовому чанку нельзя тянуть их статически. */
const ENGINE_CHUNKS = ['pixi', 'gsap', 'spine'];

const STATIC_IMPORT = /(?:\bfrom\s*|\bimport\s*)["']\.\/([^"']+\.js)["']/g;

const fail = (message: string): never => {
  console.error(`bundle:check: ${message}`);
  process.exit(1);
};

if (!existsSync(JS_DIR)) {
  fail('нет dist/assets/js - сначала npm run build');
}

const files = readdirSync(JS_DIR).filter((file) => file.endsWith('.js'));
const readChunk = (file: string): Buffer => readFileSync(join(JS_DIR, file));

const sizeOf = (chunkFiles: readonly string[]): { raw: number; gzip: number } =>
  chunkFiles.reduce(
    (sum, file) => {
      const source = readChunk(file);

      return {
        raw: sum.raw + source.length / KB,
        gzip: sum.gzip + gzipSync(source, { level: 9 }).length / KB,
      };
    },
    { raw: 0, gzip: 0 }
  );

/** Имя чанка без хеша: `pixi-VMoWExrL.js` -> `pixi`. */
const chunkName = (file: string): string => file.replace(/-[\w-]{8}\.js$/, '');

/** Файл чанка по имени; имя обязано быть единственным. */
const findChunk = (name: string): string | null => {
  const matches = files.filter((file) => chunkName(file) === name);

  if (matches.length > 1) {
    fail(`имя чанка «${name}» неоднозначно: ${matches.join(', ')}`);
  }

  return matches[0] ?? null;
};

/** Статическое замыкание чанков (без `import()`): то, что браузер грузит сразу. */
const staticClosure = (entries: readonly string[]): string[] => {
  const seen = new Set(entries);
  const queue = [...entries];

  while (queue.length > 0) {
    const source = readChunk(queue.shift() as string).toString('utf8');

    for (const [, file] of source.matchAll(STATIC_IMPORT)) {
      if (!seen.has(file) && files.includes(file)) {
        seen.add(file);
        queue.push(file);
      }
    }
  }

  return [...seen];
};

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const startEntries = [...html.matchAll(/(?:src|href)="[^"]*assets\/js\/([^"/]+\.js)"/g)].map(
  ([, file]) => file
);

if (startEntries.length === 0) {
  fail('в dist/index.html нет точки входа');
}

const rows: string[] = [];
const errors: string[] = [];
const format = (value: number): string => value.toFixed(2).padStart(8);

const check = (label: string, size: { raw: number; gzip: number }, budget: IBudget): void => {
  const isOver = size.raw > budget.raw || size.gzip > budget.gzip;

  rows.push(
    `${label.padEnd(28)} ${format(size.raw)} / ${String(budget.raw).padStart(4)} КБ` +
      `   gzip ${format(size.gzip)} / ${String(budget.gzip).padStart(4)} КБ${isOver ? '   ПРЕВЫШЕН' : ''}`
  );

  if (isOver) {
    errors.push(`${label}: ${size.raw.toFixed(2)} КБ / gzip ${size.gzip.toFixed(2)} КБ`);
  }
};

const startFiles = staticClosure(startEntries);
const startEngine = startFiles.filter((file) => ENGINE_CHUNKS.includes(chunkName(file)));

if (startEngine.length > 0) {
  errors.push(`стартовый чанк тянет движок: ${startEngine.join(', ')}`);
}

check(`start (${startFiles.map(chunkName).join(' + ')})`, sizeOf(startFiles), START_BUDGET);

Object.entries(CHUNK_BUDGETS).forEach(([name, budget]) => {
  const file = findChunk(name);

  if (!file) {
    if (!budget.optional) {
      errors.push(`нет чанка «${name}»`);
    }

    return;
  }

  check(name, sizeOf([file]), budget);
});

const gameScreen = findChunk('GameScreen');

if (gameScreen) {
  const spineInGame = staticClosure([gameScreen]).filter((file) => chunkName(file) === 'spine');

  if (spineInGame.length > 0) {
    errors.push('GameScreen статически тянет чанк spine - Spine должен грузиться лениво');
  }
}

const total = sizeOf(files);

rows.push(`${'всего JS'.padEnd(28)} ${format(total.raw)} КБ        gzip ${format(total.gzip)} КБ`);
console.log(rows.join('\n'));

if (errors.length > 0) {
  fail(`\n- ${errors.join('\n- ')}`);
}

console.log('bundle:check: бюджет соблюдён');
