import { BOARD_TIMING } from '../configs/timing';

/**
 * Чистые правила темпа доски: сколько длится падение, когда стартует соседняя
 * фишка колонки и сколько ждать между итерациями каскада.
 *
 * Отдельно от `configs/timing` и от рантайма намеренно. В конфиге лежат числа, а
 * здесь - то, что из них считается, и именно это можно проверить тестом:
 * «падение на пять строк дольше падения на одну», «пауза каскада убывает, но не
 * ниже пола».
 */

/**
 * Длительность падения на `fallDistance` строк.
 *
 * Настоящее падение на большем расстоянии занимает больше времени - именно
 * поэтому длительность растёт, а не остаётся фиксированной. Кривая при этом
 * `Quad.easeIn` (см. `BoardEntity.fall`), так что фишка ещё и разгоняется.
 *
 * Расстояние меньше одной строки в рантайме не встречается (`planBoardGravity`
 * отдаёт только реально сдвинувшиеся клетки), но правило обязано быть
 * тотальным: ноль и отрицательное расстояние - это `baseMs`, а не отрицательная
 * длительность, на которой движок твинов завершил бы твин в тот же кадр.
 */
export const resolveFallDurationMs = (fallDistance: number): number => {
  const rows = Math.max(0, fallDistance);

  return BOARD_TIMING.fall.baseMs + BOARD_TIMING.fall.perRowMs * rows;
};

/**
 * Задержка старта для клетки, стоящей `stackIndex`-й снизу в своей колонке.
 *
 * Ноль - у самой нижней: она падает первой, а те, что над ней, трогаются чуть
 * позже. Без этого вся колонка стартовала одновременно и читалась как
 * телепортация блока, а не обрушение.
 */
export const resolveFallDelayMs = (stackIndex: number): number =>
  Math.max(0, stackIndex) * BOARD_TIMING.fall.staggerMs;

/**
 * Пауза после `iteration`-й итерации каскада (нумерация с единицы).
 *
 * Убывает с глубиной: каскад должен набирать, а не идти ровным шагом. Пол
 * (`iterationDelayMinMs`) нужен, чтобы глубокая цепочка не превращалась в
 * неразличимую кашу без пауз между звеньями.
 */
export const resolveCascadeIterationDelayMs = (iteration: number): number => {
  const depth = Math.max(1, iteration);
  const delay =
    BOARD_TIMING.cascade.iterationDelayMs - BOARD_TIMING.cascade.iterationDelayStepMs * (depth - 1);

  return Math.max(BOARD_TIMING.cascade.iterationDelayMinMs, delay);
};

/**
 * Задержка проявления клетки фона доски на старте уровня.
 *
 * Волна идёт от центра поля наружу: расстояние до центра в клетках, умноженное
 * на шаг. Метрика евклидова, а не манхэттенская, - иначе фронт волны шёл бы
 * ромбом, и на прямоугольном поле это видно.
 *
 * Центр считается по числу клеток, а не по индексам: у поля с чётной стороной
 * он приходится между клетками (`(6-1)/2 = 2.5`), и это правильно - иначе на
 * чётной стороне волна выходила бы из клетки, смещённой на полшага.
 *
 * Правило тотально: вырожденное поле 1x1 и нулевые размеры дают ноль, а не
 * `NaN` - на нём движок твинов принял бы твин с `delay: NaN` молча, и клетка не
 * появилась бы вовсе.
 */
export const resolveBoardIntroDelayMs = (
  col: number,
  row: number,
  colCount: number,
  rowCount: number
): number => {
  const centerCol = (Math.max(1, colCount) - 1) / 2;
  const centerRow = (Math.max(1, rowCount) - 1) / 2;
  const distance = Math.hypot(col - centerCol, row - centerRow);

  return Math.round(distance * BOARD_TIMING.intro.waveStepMs);
};

/**
 * Длительность полёта пропеллера к цели: шаг на клетку пути в коридоре
 * `flightMinMs`..`flightMaxMs`. Расстояние - евклидово, в клетках: пропеллер
 * летит по прямой (с дугой по высоте), а не по клеткам.
 */
export const resolvePropellerFlightMs = (distanceCells: number): number => {
  const { flightMsPerCell, flightMinMs, flightMaxMs } = BOARD_TIMING.special;
  const duration = flightMinMs + Math.max(0, distanceCells - 1) * flightMsPerCell;

  return Math.round(Math.min(flightMaxMs, duration));
};
