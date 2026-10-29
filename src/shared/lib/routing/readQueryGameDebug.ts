/**
 * Dev/QA switch: `?gameDebug=true` показывает на экране партии кнопки ручного
 * завершения («Выиграть» / «Проиграть»). Главная передаёт его виджету пропом
 * `debug`.
 *
 * Без флага их нет вовсе: это отладка, а не часть экрана - иначе любой игрок
 * мог бы выиграть уровень, не сыграв. Обычный исход партии приходит только из
 * рантайма (`useGameRuntimeEvents`).
 *
 * Именно query, а не `import.meta.env.DEV`: кнопки нужны QA на обычном стенде,
 * где собран production-бандл, а не только на локальном dev-сервере. Правило
 * чистое и живёт рядом с остальными query-флагами (`readQueryLevel`),
 * чтобы трактовка строки запроса не расползлась по копиям.
 */
export const readQueryGameDebug = (search = window.location.search): boolean => {
  const value = new URLSearchParams(search).get('gameDebug')?.trim().toLowerCase();

  return value === 'true';
};
