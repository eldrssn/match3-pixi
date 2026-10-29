import { Container, Graphics, type Text } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { getRuntimeStarScores } from '../configs/levelConfig';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport } from '../core/RuntimeEvents';
import { resolveLitStars, resolveStarPoints } from '../lib/hudRules';
import { createRuntimeText } from '../lib/runtimeText';
import {
  formatScoreMeterText,
  resolveScoreMeterFill,
  resolveScoreMeterMarks,
} from '../lib/scoreMeter';
import { addDisplayTween } from '../motion/displayMotion';
import type { IMotionTween } from '../motion/RuntimeMotion';
import { useGameStore, type GameStore } from '../store/GameStore';

/** На сколько дизайн-px строка очков выше панели бустеров. */
const METER_ABOVE_BOOSTERS = 94;
/** Высота строки над нижним краем безопасной зоны, дизайн-px. */
const METER_OFFSET_Y = GAME_CONFIG.boostersContainerOffsetY - METER_ABOVE_BOOSTERS;
const BAR_WIDTH = 150;
const BAR_HEIGHT = 8;
/** Зазор между полосой и числом очков. */
const SCORE_GAP = 10;
/** Половина типичной ширины числа очков: по центру стоит вся пара «полоса + число». */
const SCORE_TEXT_HALF_WIDTH = 24;
const STAR_OUTER = 9;
const STAR_INNER = 4;
const STAR_POINTS = resolveStarPoints(STAR_OUTER, STAR_INNER);

const TRACK_COLOR = SKIN.colors.hud.scoreTrack;
const FILL_COLOR = SKIN.colors.hud.scoreFill;
const STAR_OUTLINE = SKIN.colors.hud.starOutline;

/** Счёт догоняет новое значение, а не прыгает к нему. */
const COUNT_UP_MS = 260;
const STAR_POP_SCALE = 1.5;
const STAR_POP_MS = 220;

/**
 * Очки партии и прогресс к звёздам - строка под доской: полоса с тремя
 * звёздами и число. Порт `ScoreMeter` Phaser-эталона: первая звезда горит за
 * победу, вторая и третья - на порогах очков (`starScores`); без порогов -
 * подпись «Очки: N» по центру. Модуль только подписан на стор.
 */
export class ScoreMeter {
  private readonly core: GameRuntimeCore;
  private readonly container = new Container({ label: 'ScoreMeter' });
  private readonly bar: Graphics | null = null;
  private readonly stars: Graphics[] = [];
  private readonly text: Text;
  private readonly thresholds: readonly [number, number] | undefined;
  private readonly unsubscribe: () => void;
  private readonly offResize: () => void;
  private shown = 0;
  /** Какие из трёх звёзд уже горят: звезда загорается один раз. */
  private readonly lit = [false, false, false];
  private countTween: IMotionTween | null = null;

  constructor(core: GameRuntimeCore) {
    this.core = core;
    core.layers.get('BottomMenu').addChild(this.container);

    this.thresholds = getRuntimeStarScores();
    this.text = createRuntimeText(
      formatScoreMeterText(0, this.thresholds),
      GAME_CONFIG.movesCounterTextConfig,
      { fontSize: '16px' }
    );
    this.text.y = METER_OFFSET_Y;

    if (this.thresholds) {
      const left = -(BAR_WIDTH + SCORE_GAP) / 2 - SCORE_TEXT_HALF_WIDTH;
      const bar = new Graphics();

      bar.position.set(left, METER_OFFSET_Y);
      this.container.addChild(bar);
      this.bar = bar;

      resolveScoreMeterMarks(this.thresholds).forEach((mark) => {
        const star = new Graphics();

        star.position.set(left + mark * BAR_WIDTH, METER_OFFSET_Y);
        this.container.addChild(star);
        this.stars.push(star);
      });

      this.text.position.set(left + BAR_WIDTH + SCORE_GAP, METER_OFFSET_Y);
      this.text.anchor.set(0, 0.5);
      this.drawBar(0);
      this.stars.forEach((star) => this.drawStar(star, false));
    }

    this.container.addChild(this.text);

    this.unsubscribe = useGameStore.subscribe(this.handleStoreChange);
    this.offResize = core.events.on('resize', this.handleResize);
    this.handleResize(core.viewport);
  }

  private handleStoreChange = (state: GameStore, previous: GameStore): void => {
    if (state.score !== previous.score) {
      this.countTo(state.score);
    }

    if (
      state.isGameEnded !== previous.isGameEnded ||
      state.isGameWin !== previous.isGameWin ||
      state.score !== previous.score
    ) {
      this.refreshStars(state);
    }
  };

  /** Число и полоса доезжают до нового счёта одним коротким твином. */
  private countTo(score: number): void {
    this.countTween?.kill();

    const counter = { value: this.shown };

    this.countTween = this.core.motion.add(
      counter,
      { value: score },
      {
        duration: COUNT_UP_MS,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          if (this.text.destroyed) {
            return;
          }

          this.shown = counter.value;
          this.text.text = formatScoreMeterText(counter.value, this.thresholds);

          if (this.thresholds) {
            this.drawBar(resolveScoreMeterFill(counter.value, this.thresholds));
          }
        },
        onComplete: () => {
          this.countTween = null;
        },
      }
    );
  }

  private refreshStars(state: GameStore): void {
    if (!this.thresholds) {
      return;
    }

    resolveLitStars(state, this.thresholds).forEach((isLit, index) => {
      const star = this.stars[index];

      if (!isLit || this.lit[index] || !star) {
        return;
      }

      this.lit[index] = true;
      this.drawStar(star, true);
      star.scale.set(STAR_POP_SCALE);
      addDisplayTween(
        this.core.motion,
        star,
        { scale: 1 },
        { duration: STAR_POP_MS, ease: 'Back.easeOut' }
      );
    });
  }

  private drawBar(fill: number): void {
    const { bar } = this;
    const radius = BAR_HEIGHT / 2;

    if (!bar || bar.destroyed) {
      return;
    }

    bar.clear();
    bar
      .roundRect(0, -radius, BAR_WIDTH, BAR_HEIGHT, radius)
      .fill({ color: TRACK_COLOR, alpha: 0.9 });

    if (fill > 0) {
      bar
        .roundRect(0, -radius, Math.max(BAR_HEIGHT, BAR_WIDTH * fill), BAR_HEIGHT, radius)
        .fill({ color: FILL_COLOR, alpha: 1 });
    }
  }

  private drawStar(star: Graphics, isLit: boolean): void {
    star
      .clear()
      .poly(STAR_POINTS, true)
      .fill({ color: isLit ? SKIN.colors.starLit : SKIN.colors.starDim, alpha: 1 })
      .stroke({ width: 2, color: STAR_OUTLINE, alpha: 1 });
  }

  private handleResize = ({ width, layout }: IRuntimeViewport): void => {
    this.container.scale.set(layout.scale);
    this.container.position.set(width / 2, layout.bottom);
  };

  destroy(): void {
    this.unsubscribe();
    this.offResize();
    this.countTween = null;
    this.container.destroy({ children: true });
  }
}
