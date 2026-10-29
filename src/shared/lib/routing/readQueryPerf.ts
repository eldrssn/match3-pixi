/** Режим качества отрисовки, заданный QA-флагом. */
export type TQueryPerfMode = 'high' | 'low';

/**
 * Dev/QA переключатель `?perf=low|high`: зафиксировать качество отрисовки
 * партии вместо перф-гейта (`widgets/game` `PerfMonitor`). `low` - проверить
 * на мощной машине, как партия выглядит на слабом Android; `high` - снять
 * понижение, чтобы сравнить FPS с ним и без него.
 *
 * Любое другое значение игнорируется: качество решает перф-гейт сам.
 */
export const readQueryPerf = (search = window.location.search): TQueryPerfMode | null => {
  const raw = new URLSearchParams(search).get('perf')?.trim().toLowerCase();

  return raw === 'low' || raw === 'high' ? raw : null;
};
