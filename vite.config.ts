import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { visualizer } from 'rollup-plugin-visualizer';
import { configDefaults, defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';
import { loadBuildEnv, readBooleanEnv, requireAppEnv, requireEnv } from './config/buildEnv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** Медленные тесты - отдельный проект vitest (`slow`), вне `npm test`. */
const SLOW_TEST_PATTERNS = ['src/**/*.bot.test.ts', 'src/**/*.perf.test.ts'];

export default defineConfig(({ command, mode }) => {
  const buildEnv = loadBuildEnv(__dirname);
  const env = { ...loadEnv(mode, process.cwd(), ''), ...buildEnv.values };
  const isBuild = command === 'build';
  const isDev = mode !== 'production';
  const isAnalyze = readBooleanEnv(env, 'ANALYZE');
  const base = env.VITE_CDN_BASE_URL || '/';
  // Редактор уровней - инструмент геймдизайнера на стейдже, а не часть игры:
  // в dev-сервере он есть по умолчанию, в сборку попадает только с флагом.
  // Флаг - константа сборки (`__EDITOR_ENABLED__`), а не чтение env в рантайме:
  // без него ленивый чанк редактора выпадает из бандла целиком.
  const isEditorEnabled = readBooleanEnv(env, 'VITE_ENABLE_EDITOR', !isBuild);

  if (isBuild) {
    console.info(`[env] build env sources: ${buildEnv.summary}`);

    const appEnv = requireEnv(env, 'VITE_APP_ENV', 'production build', buildEnv.summary);
    requireAppEnv(appEnv, 'VITE_APP_ENV');
    console.info(`[env] level editor (/editor): ${isEditorEnabled ? 'on' : 'off'}`);
  }

  return {
    base,
    plugins: [
      react(),
      svgr(),
      isAnalyze &&
        visualizer({
          open: true,
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }),
    ].filter(Boolean),

    build: {
      outDir: 'dist',
      sourcemap: isDev ? true : false,
      minify: 'esbuild',
      target: 'es2020',
      modulePreload: {
        polyfill: false,
      },
      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 2048,
      cssCodeSplit: true,
      reportCompressedSize: true,
      rollupOptions: {
        treeshake: true,
        output: {
          manualChunks: (id) => {
            // Помощник предзагрузки динамических импортов Vite - в стартовый
            // `vendor`. Иначе Rollup кладёт его к первому импортёру с
            // `import()` - в `pixi` (рендереры Pixi грузятся динамически), и
            // стартовый чанк тянет весь Pixi ради одной функции.
            if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) {
              return 'vendor';
            }

            // Pixi, GSAP и Spine нужны только внутри партии и приезжают вместе с
            // ленивым `widgets/game`. В общем `vendor` они ломали бы весь смысл
            // ленивой загрузки: чанк грузится на старте, а движок весит больше,
            // чем всё остальное приложение. Spine - отдельно: он нужен только
            // скину с видом клетки `spine`.
            // Только пакеты Spine: обвязка `widgets/game/spine/spineRuntime`
            // остаётся своим маленьким чанком. Положи её сюда - Rollup утянет
            // за ней общие модули рантайма, и `spine` станет статической
            // зависимостью `GameScreen` и стартового чанка (ловит
            // `npm run bundle:check`).
            if (/node_modules[\\/]@esotericsoftware[\\/]/.test(id)) {
              return 'spine';
            }

            // Зависимости самого Pixi (триангуляция, LRU-кэш, шина, детект
            // устройства, разбор SVG) - туда же: без этого Rollup клал их в
            // стартовый `vendor` (~25 КБ gzip, которых главной не нужно).
            if (
              /node_modules[\\/](pixi\.js|@pixi|earcut|tiny-lru|eventemitter3|ismobilejs|parse-svg-path|@xmldom|gifuct-js)[\\/]/.test(
                id
              )
            ) {
              return 'pixi';
            }

            if (/node_modules[\\/]gsap[\\/]/.test(id)) {
              return 'gsap';
            }

            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/png|jpe?g|webp|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff2?|eot|ttf|otf/i.test(ext || '')) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
    },

    server: {
      port: 3000,
      open: false,
      fs: {
        strict: true,
      },
    },

    resolve: {
      alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
    },

    css: {
      modules: {
        scopeBehaviour: 'local',
        generateScopedName: isDev ? '[name]__[local]__[hash:base64:5]' : '[hash:base64:8]',
      },
      devSourcemap: isDev,
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __BUILD_MODE__: JSON.stringify(mode),
      __EDITOR_ENABLED__: JSON.stringify(isEditorEnabled),
    },

    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },

    test: {
      globals: true,
      environment: 'jsdom',
      // Абсолютные пути от папки проекта: относительный `setupFiles` Vitest
      // резолвит от корня git-репозитория, а папка проекта может им не быть.
      root: __dirname,
      setupFiles: path.resolve(__dirname, 'src/shared/testing/setup.ts'),
      exclude: [...configDefaults.exclude, 'docs/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json'],
        exclude: ['node_modules/', 'src/**/*.d.ts', 'src/**/*.config.*', 'src/**/__tests__/**'],
      },
      // `unit` - быстрые тесты для `npm test` и watch. `slow` - проверка
      // каталога ботом-солвером и перф-гейт движка: десятки секунд и бюджет по
      // часам, в watch они перезапускались бы на любой правке `entities/game`.
      // Оба проекта гоняет `npm run test:ci` (CI-задача `test`).
      projects: [
        {
          extends: true,
          test: { name: 'unit', exclude: SLOW_TEST_PATTERNS },
        },
        {
          extends: true,
          test: { name: 'slow', include: SLOW_TEST_PATTERNS },
        },
      ],
    },

    assetsInclude: ['**/*.ttf', '**/*.otf'],
  };
});
