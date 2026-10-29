/** Скачать значение JSON-файлом: выгрузка уровня и пака из редактора. */
export const downloadJsonFile = (fileName: string, value: unknown): void => {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Скачивание стартует асинхронно: отзыв URL в том же такте может его оборвать.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Имя файла выгрузки пака - то, что ждёт `npm run levels:import <file>`. */
export const packFileName = (packId: string): string => `pack_${packId || 'untitled'}.json`;
