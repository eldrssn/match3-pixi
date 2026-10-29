import { UPDATE_PRIORITY, type Ticker } from 'pixi.js';
import type { TRenderQualityMode } from '../configs/renderQuality';
import { applyRenderQuality } from '../lib/applyRenderQuality';
import { createPerfGovernor } from '../lib/perfGovernor';
import { useGameStore } from '../store/GameStore';

/** Окно замера FPS. */
const SAMPLE_INTERVAL_MS = 1000;

/**
 * Перф-гейт партии: раз в секунду считает FPS тикера Pixi и, если партия
 * устойчиво не тянет (`lib/perfGovernor`), понижает качество отрисовки
 * (`configs/renderQuality`) - меньше разрешение бэкбуфера и украшений. Канвас
 * под новое разрешение пересобирает React-слой (`useGameRuntime` подписан на
 * `renderQuality` стора и зовёт ресайз рантайма с новым DPR).
 *
 * Замер живёт на тикере: на паузе (хост держит доску) тикер стоит, и замера
 * нет. FPS - кадры окна, делённые на его длительность, а не мгновенный
 * `ticker.FPS` одного кадра. Кадр длиннее самого окна (вкладка была скрыта,
 * браузер душил кадры) - не просадка, а разрыв: окно начинается заново.
 * Режим `high`/`low` от хоста (QA-флаг `?perf=`) гейт выключает: качество уже
 * решено.
 */
export class PerfMonitor {
  private readonly ticker: Ticker;
  private readonly judge = createPerfGovernor();
  private readonly mode: TRenderQualityMode;
  private frames = 0;
  private windowMs = 0;

  constructor(ticker: Ticker, mode: TRenderQualityMode) {
    this.ticker = ticker;
    this.mode = mode;
    ticker.add(this.tick, this, UPDATE_PRIORITY.UTILITY);
  }

  private tick(ticker: Ticker): void {
    // `elapsedMS` - сырой интервал кадра; `deltaMS` тикер подрезает снизу по
    // `minFPS` и для замера не годится.
    const frameMs = ticker.elapsedMS;

    if (frameMs > SAMPLE_INTERVAL_MS || (typeof document !== 'undefined' && document.hidden)) {
      this.frames = 0;
      this.windowMs = 0;

      return;
    }

    this.frames++;
    this.windowMs += frameMs;

    if (this.windowMs < SAMPLE_INTERVAL_MS) {
      return;
    }

    const fps = Math.round((this.frames * SAMPLE_INTERVAL_MS) / this.windowMs);

    this.frames = 0;
    this.windowMs = 0;
    this.sample(fps);
  }

  private sample(fps: number): void {
    const store = useGameStore.getState();

    store.setFps(fps);

    if (this.mode === 'auto' && store.renderQuality === 'high' && this.judge(fps)) {
      applyRenderQuality('low');
    }
  }

  destroy(): void {
    this.ticker.remove(this.tick, this);
  }
}
