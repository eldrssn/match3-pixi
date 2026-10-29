/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'dev' | 'test' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Есть ли в сборке редактор уровней (`/editor` и кнопка на главной): флаг
 * `VITE_ENABLE_EDITOR`, по умолчанию включён в dev-сервере и выключен в
 * `vite build`. Подставляется сборкой (`define` в `vite.config.ts`).
 */
declare const __EDITOR_ENABLED__: boolean;
