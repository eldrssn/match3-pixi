/**
 * Сколько твин проживёт в худшем случае - для страховочного таймера
 * `RuntimeMotion.tween` (см. там же, зачем он нужен).
 *
 * Модуль без GSAP: правило чистое и покрыто тестом.
 */

/**
 * Запас поверх расчётной длительности. Твин обновляется по кадрам и почти
 * всегда финиширует чуть позже номинала, поэтому страховка не должна
 * срабатывать раньше честного `onComplete` на нормальной анимации. Число то
 * же, что у Phaser-эталона (`tweenPromise`).
 */
export const TWEEN_TIMEOUT_SAFETY_MS = 400;

/**
 * Длительность твина без `duration` - как у Phaser-твина эталона (1000 мс),
 * а не как у GSAP (500 мс): модули переносятся с эталона и полагаются на его
 * дефолт.
 */
export const DEFAULT_TWEEN_DURATION_MS = 1000;

export interface ITweenTiming {
  /** Длительность одного прохода, мс. */
  duration?: number;
  /** Задержка до старта, мс. */
  delay?: number;
  /** Сколько раз повторить после первого прохода; `-1` - бесконечно. */
  repeat?: number;
  /** Каждый повтор - туда и обратно (у Phaser проход с `yoyo` вдвое длиннее). */
  yoyo?: boolean;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Время жизни твина со страховочным запасом, мс.
 *
 * `null` - если по параметрам этого не посчитать (`repeat: -1` бесконечен,
 * не число). Тогда страховочного таймера нет: ложный ранний резолв хуже
 * отсутствия страховки, потому что рвёт цикл матчей на середине.
 */
export const estimateTweenLifetimeMs = ({
  duration = DEFAULT_TWEEN_DURATION_MS,
  delay = 0,
  repeat = 0,
  yoyo = false,
}: ITweenTiming): number | null => {
  if (
    !isFiniteNumber(duration) ||
    !isFiniteNumber(delay) ||
    !isFiniteNumber(repeat) ||
    repeat < 0
  ) {
    return null;
  }

  const cycle = duration * (yoyo ? 2 : 1);

  return delay + cycle * (repeat + 1) + TWEEN_TIMEOUT_SAFETY_MS;
};
