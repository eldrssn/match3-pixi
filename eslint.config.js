import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Границы слоёв: app → pages → widgets → features → entities → shared.
 * Слой импортирует только слои ниже себя (и `@/assets`); вверх - нельзя.
 * Пример хоста (`@/widgets/modals`) собирают только `app` и `pages/main`:
 * переиспользуемые слои о нём не знают. Межслойный импорт - только через
 * алиас `@/`, относительный путь в чужой слой запрещён, иначе правило слоя
 * обходится одной `../`.
 *
 * Правило одно (`no-restricted-imports`), поэтому у файла действует последний
 * подходящий блок - каждый блок перечисляет запреты своего слоя целиком.
 */
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

const layerGroup = (layer) => ({
  group: [`@/${layer}`, `@/${layer}/**`],
  message: `Слой не импортирует \`@/${layer}\`: зависимости идут только вниз (app → pages → widgets → features → entities → shared).`,
});

const RELATIVE_CROSS_LAYER = {
  regex: `^(\\.\\./)+(.*/)?(${LAYERS.join('|')})/`,
  message: 'Импорт из другого слоя - через алиас `@/`, а не относительным путём.',
};

/**
 * Срезы `entities` кроме домена игры. `RELATIVE_CROSS_LAYER` ловит только
 * выход в другой слой, а `../../skin` из `entities/game/lib` остаётся внутри
 * `entities`: соседний срез из домена игры - тоже только алиасом, где его
 * сторожит свой запрет (скин домену нельзя вовсе). Список читается с диска,
 * чтобы новый срез попал под правило без правки конфига.
 */
const ENTITY_SLICES_BESIDE_GAME = readdirSync(join(__dirname, 'src/entities'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && entry.name !== 'game')
  .map((entry) => entry.name);

const RELATIVE_CROSS_ENTITY_FROM_GAME = {
  regex: `^(\\.\\./)+(.*/)?(${ENTITY_SLICES_BESIDE_GAME.join('|')})(/|$)`,
  message:
    '`entities/game` не ходит в соседний срез относительным путём: скин домену запрещён, остальное - через алиас `@/`.',
};

const EXAMPLE_HOST_MODALS = {
  group: ['@/widgets/modals', '@/widgets/modals/**'],
  message:
    'Модалки примера хоста (`@/widgets/modals`) собирают только `app` и `pages/main`: свой хост пишет свои (docs/custom-host.md).',
};

const restrictImports = (patterns) => ({
  'no-restricted-imports': ['error', { patterns: [RELATIVE_CROSS_LAYER, ...patterns] }],
});

const forbidAbove = (layer) =>
  LAYERS.slice(0, LAYERS.indexOf(layer)).map((upper) => layerGroup(upper));

const layerBoundaries = [
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: restrictImports([...forbidAbove('pages'), EXAMPLE_HOST_MODALS]),
  },
  { files: ['src/pages/main/**/*.{ts,tsx}'], rules: restrictImports(forbidAbove('pages')) },
  {
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: restrictImports([...forbidAbove('widgets'), EXAMPLE_HOST_MODALS]),
  },
  { files: ['src/widgets/modals/**/*.{ts,tsx}'], rules: restrictImports(forbidAbove('widgets')) },
  { files: ['src/features/**/*.{ts,tsx}'], rules: restrictImports(forbidAbove('features')) },
  { files: ['src/entities/**/*.{ts,tsx}'], rules: restrictImports(forbidAbove('entities')) },
  {
    // Домен игры не знает, как элемент выглядит: ни скина, ни URL ассетов.
    files: ['src/entities/game/**/*.{ts,tsx}'],
    rules: restrictImports([
      ...forbidAbove('entities'),
      {
        group: [
          '@/entities/skin',
          '@/entities/skin/**',
          '@/shared/lib/assets',
          '@/shared/lib/assets/**',
        ],
        message:
          '`entities/game` не импортирует скин и ассеты: вид элемента - запись в `entities/skin`.',
      },
      { regex: '\\?url$', message: '`entities/game` не импортирует ассеты (`?url`).' },
      RELATIVE_CROSS_ENTITY_FROM_GAME,
    ]),
  },
  { files: ['src/shared/**/*.{ts,tsx}'], rules: restrictImports(forbidAbove('shared')) },
];

export default tseslint.config(
  {
    // ESLint не читает `.gitignore`, поэтому локальные каталоги оттуда
    // приходится перечислять здесь же. `graphify-out` - генерируемый граф.
    ignores: ['dist', 'coverage', 'node_modules', 'docs/**', 'graphify-out/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
      prettierConfig,
    ],
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      'no-console': 'off',
      'no-debugger': 'error',
      // Отключено намеренно: в русскоязычных строках и разметке встречаются
      // неразрывные пробелы (U+00A0), и это не ошибка, а нужный символ.
      'no-irregular-whitespace': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  ...layerBoundaries,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    extends: [js.configs.recommended, prettierConfig],
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': 'off',
      'no-debugger': 'error',
      'no-irregular-whitespace': 'off',
    },
  }
);
