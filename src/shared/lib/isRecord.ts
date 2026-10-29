/**
 * Обычный объект из произвольного JSON: не `null` и не массив. Разбор
 * хранилища и файлов (прогресс, пак уровней, черновик редактора) начинается с
 * этой проверки, чтобы читать поля без исключений.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
