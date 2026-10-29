import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Баррель `@/widgets/game` входит в стартовый чанк хоста, поэтому обязан
 * оставаться без движка отрисовки (см. комментарий в `index.ts`): ни Pixi, ни
 * GSAP, ни Spine. ESLint видит только прямые импорты файла, а пакет приезжает
 * транзитивно - тест обходит статический граф импортов барреля и ищет их. Динамический `import()`
 * (lazy-чанк экрана) и `import type` в граф не входят: они не тянут код в чанк.
 */
const SRC_ROOT = resolve(__dirname, '../..');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;

const resolveModule = (specifier: string, fromFile: string): string | null => {
  const base = specifier.startsWith('@/')
    ? resolve(SRC_ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : null;

  if (base === null) {
    return null;
  }

  if (existsSync(base) && /\.tsx?$/.test(base)) {
    return base;
  }

  const candidate = EXTENSIONS.map((ext) => base + ext).find((path) => existsSync(path));

  return candidate ?? null;
};

const collectPackages = (entry: string): { packages: Set<string>; chain: Map<string, string> } => {
  const packages = new Set<string>();
  const chain = new Map<string, string>();
  const queue = [entry];
  const seen = new Set(queue);

  while (queue.length > 0) {
    const file = queue.shift() as string;
    const source = readFileSync(file, 'utf8');

    for (const [, specifier] of source.matchAll(STATIC_IMPORT)) {
      if (specifier.includes('?')) {
        continue;
      }

      const resolved = resolveModule(specifier, file);

      if (resolved === null) {
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
          packages.add(specifier);
          chain.set(specifier, file);
        }
        continue;
      }

      if (!seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }

  return { packages, chain };
};

/** Пакеты рантайма партии: им место только в ленивом чанке экрана. */
const RUNTIME_PACKAGES = ['pixi.js', 'gsap', '@esotericsoftware/', 'phaser'];

const isRuntimePackage = (name: string): boolean =>
  RUNTIME_PACKAGES.some((pkg) =>
    pkg.endsWith('/') ? name.startsWith(pkg) : name === pkg || name.startsWith(`${pkg}/`)
  );

describe('@/widgets/game barrel', () => {
  it('статически не тянет Pixi, GSAP и Spine', () => {
    const { packages, chain } = collectPackages(resolve(__dirname, 'index.ts'));
    const runtime = [...packages].filter(isRuntimePackage);

    expect(runtime.map((name) => `${name} <- ${chain.get(name)}`)).toEqual([]);
  });

  it('экран партии статически не тянет Spine: он - ленивый чанк `spine` скина со Spine', () => {
    const { packages, chain } = collectPackages(resolve(__dirname, 'ui/GameScreen.tsx'));
    const spine = [...packages].filter((name) => name.startsWith('@esotericsoftware/'));

    expect(packages.has('pixi.js')).toBe(true);
    expect(spine.map((name) => `${name} <- ${chain.get(name)}`)).toEqual([]);
  });

  it('узнаёт пакеты рантайма', () => {
    expect(
      ['pixi.js', 'gsap', 'gsap/all', '@esotericsoftware/spine-pixi-v8'].every(isRuntimePackage)
    ).toBe(true);
    expect(['react', 'zustand', 'pixi-filters-not'].some(isRuntimePackage)).toBe(false);
  });
});
