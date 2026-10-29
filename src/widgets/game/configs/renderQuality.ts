/**
 * Качество отрисовки партии: `high` - полное, `low` - для слабых устройств
 * (перф-гейт, `modules/PerfMonitor`).
 *
 * Низкое качество режет то, что стоит больше всего, а игре не нужно:
 * разрешение бэкбуфера (fill-rate - главный расход на слабом Android, см.
 * `renderScale.ts`), половину частиц разрушения, хвосты падения и дыхание
 * фишек простоя. Правила доски, анимации хода и звук не меняются.
 *
 * Состояние модульное, как у `renderScale`: его читают функции отрисовки, а
 * не React. Владелец - рантайм партии: стартовое качество выставляет
 * `setRuntimeLevelConfig` (до замера канваса), `PerfMonitor` понижает его на
 * просадке; оба пишут через `lib/applyRenderQuality` - вместе с зеркалом в
 * `GameStore`.
 */
export type TRenderQuality = 'high' | 'low';

/**
 * Режим партии от хоста: `auto` - перф-гейт сам понижает качество на
 * устойчивой просадке FPS; `high`/`low` - качество зафиксировано
 * (QA-флаг `?perf=`).
 */
export type TRenderQualityMode = 'auto' | TRenderQuality;

/**
 * Кап DPR низкого качества. 1.5 вместо 3 - вчетверо меньше пикселей
 * бэкбуфера на DPR-3 экране; арт при этом всё ещё не мельче физического
 * разрешения бюджетных экранов (DPR 1.5-2).
 */
export const LOW_QUALITY_DPR_CAP = 1.5;

/** Частиц в одном всплеске разрушения клетки. */
export const BURST_PARTICLES: Record<TRenderQuality, number> = { high: 10, low: 5 };

let renderQuality: TRenderQuality = 'high';

export const getRenderQuality = (): TRenderQuality => renderQuality;

export const setRenderQuality = (quality: TRenderQuality): void => {
  renderQuality = quality;
};

/** Стартовое качество партии по режиму хоста. */
export const resolveStartRenderQuality = (mode: TRenderQualityMode): TRenderQuality =>
  mode === 'low' ? 'low' : 'high';
