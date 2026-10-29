/**
 * Перф-гейт партии: когда понижать качество отрисовки (`configs/renderQuality`).
 *
 * Решение по ежесекундным замерам FPS: первые секунды (загрузка текстур,
 * интро цели, сборка доски) не в счёт, а дальше качество понижается после
 * нескольких секунд подряд ниже порога - одиночная просадка (сборка мусора,
 * уведомление ОС) этого не стоит. Понижение одностороннее и одно на партию:
 * качество, прыгающее туда-обратно, заметнее просадки.
 */
export interface IPerfGovernorOptions {
  /** Сколько первых замеров пропустить. */
  warmupSamples: number;
  /** Ниже скольких FPS замер считается просадкой. */
  lowFps: number;
  /** Сколько просадок подряд нужно, чтобы понизить качество. */
  sustainSamples: number;
}

export const PERF_GOVERNOR_OPTIONS: IPerfGovernorOptions = {
  warmupSamples: 3,
  lowFps: 40,
  sustainSamples: 4,
};

/** Возвращает судью: замер FPS -> пора ли понизить качество (ровно один раз). */
export const createPerfGovernor = (
  options: IPerfGovernorOptions = PERF_GOVERNOR_OPTIONS
): ((fps: number) => boolean) => {
  let samples = 0;
  let lowStreak = 0;
  let hasDegraded = false;

  return (fps) => {
    samples++;

    if (hasDegraded || samples <= options.warmupSamples) {
      return false;
    }

    lowStreak = fps < options.lowFps ? lowStreak + 1 : 0;

    if (lowStreak >= options.sustainSamples) {
      hasDegraded = true;

      return true;
    }

    return false;
  };
};
