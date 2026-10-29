/**
 * Сообщения валидации уровня (`validateMinigameLevelConfig`) - в одном месте:
 * их видит автор уровня в редакторе и тест каталога, копия шаблона меняет
 * формулировки здесь. Домен не знает подписей элементов (они в скине):
 * `goalName` - то, что вернул `describeElement` вызывающего
 * (`IMinigameLevelValidationOptions`), без него - код формата.
 *
 * `position` - уже собранная `cellPosition(...)` подпись клетки.
 */
export const LEVEL_VALIDATION_TEXTS = {
  cellPosition: (col: number, row: number) => `(кол. ${col}, стр. ${row})`,
  cellInvalidElement: (position: string) =>
    `Клетка ${position} должна содержать допустимый элемент.`,
  directionNotLaser: (position: string) => `Ось бывает только у ракеты: клетка ${position}.`,
  directionInvalid: (position: string) =>
    `Ось ракеты в клетке ${position} - horizontal или vertical.`,
  chipColorMissing: (position: string) => `Фишки в клетке ${position} нет среди цветов уровня.`,
  layersNotCargo: (position: string) => `Слои бывают только у ящика: клетка ${position}.`,
  cargoLayersRange: (position: string, min: number, max: number) =>
    `Ящик в клетке ${position} - от ${min} до ${max} слоёв.`,
  overlayUnknown: (position: string) => `Неизвестная накладка в клетке ${position}.`,
  overlayNotOnChip: (position: string) =>
    `Накладка в клетке ${position} должна лежать поверх фишки.`,
  floorUnderHole: (position: string) => `Под дырой не бывает подложки: клетка ${position}.`,
  floorLayersRange: (position: string, min: number, max: number) =>
    `Подложка в клетке ${position} - от ${min} до ${max} слоёв.`,
  dropAtExit: (position: string) => `«Опусти вниз» в клетке ${position} уже стоит внизу колонки.`,
  legacyInnerId: (position: string) =>
    `Поле innerId - формат v1, клетка ${position}: пересохраните уровень.`,
  idInvalid: 'ID уровня должен быть положительным числом.',
  movesInvalid: 'Количество ходов должно быть положительным числом.',
  titleTooLong: (max: number) => `Название уровня - не длиннее ${max} символов.`,
  tooFewColors: (min: number) => `На уровне должно быть не меньше ${min} цветов фишек.`,
  noGoals: 'Добавьте хотя бы одну цель уровня.',
  goalInvalidId: (goalNumber: number) =>
    `Цель #${goalNumber} должна ссылаться на фишку, блокер, «опусти вниз», накладку или подложку.`,
  goalColorMissing: (goalNumber: number, goalName: string) =>
    `Цель #${goalNumber}: цвета «${goalName}» нет среди цветов уровня.`,
  goalNotEnoughOnField: (goalNumber: number, placed: number, goalName: string, count: number) =>
    `Цель #${goalNumber}: на поле ${placed} шт. «${goalName}», а нужно ${count}.`,
  goalCountInvalid: (goalNumber: number) =>
    `Количество в цели #${goalNumber} должно быть больше 0.`,
  starScoresInvalid: 'Очки на звёзды: оба порога положительные, третья звезда дороже второй.',
  noColumns: 'Поле должно содержать хотя бы одну колонку.',
  noRows: 'Поле должно содержать хотя бы одну строку.',
  gridSizeRange: (min: number, max: number) =>
    `Размер поля - от ${min}×${min} до ${max}×${max} клеток.`,
  columnLength: (colNumber: number) => `Колонка ${colNumber} имеет неверную длину.`,
} as const;
