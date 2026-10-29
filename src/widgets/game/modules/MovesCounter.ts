import { Container, Sprite, type Text } from 'pixi.js';
import { SKIN, skinTextureWidth } from '@/entities/skin';
import { movesWord } from '@/shared/lib/format';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { BOARD_TIMING } from '../configs/timing';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport } from '../core/RuntimeEvents';
import { resolveMovesColor } from '../lib/hudRules';
import { createRuntimeText } from '../lib/runtimeText';
import type { IMotionTween } from '../motion/RuntimeMotion';
import { useGameStore } from '../store/GameStore';

/** Цвет счётчика на исходе ходов. */
const LOW_MOVES_COLOR = SKIN.colors.hud.lowMovesText;

/** Обычный цвет счётчика - из того же конфига, которым текст создан. */
const NORMAL_MOVES_COLOR = GAME_CONFIG.movesCounterTextConfig.color;

/** Амплитуда пульса цифры в момент списания хода. */
const PULSE_SCALE = 1.35;

/** Масштаб плашки - дробь «дизайн-px / ширина текстуры `num` из скина». */
const MOVES_BG_DESIGN_WIDTH = 46;
const MOVES_BG_SCALE =
  (MOVES_BG_DESIGN_WIDTH / skinTextureWidth('num')) * GAME_CONFIG.headerControlScale;

/** Смещения числа и подписи от центра плашки. */
const MOVES_NUMBER_OFFSET_Y = -6;
const MOVES_LABEL_OFFSET_Y = 8;

/**
 * Счётчик ходов в правом углу шапки: число и подпись «ход/хода/ходов» на
 * плашке. Порт `MovesCounter` Phaser-эталона: пульс цифры на списании хода
 * (новое число - на пике), crossfade подписи, когда меняется форма слова,
 * тревожный цвет с трёх ходов.
 *
 * Пульс эталона - один yoyo-твин с подменой числа в `onYoyo`; у часов
 * рантайма колбэка середины нет, поэтому здесь две половины подряд: вверх
 * `Quad.easeOut`, вниз `Quad.easeIn` (обратный проход yoyo той же кривой).
 */
export class MovesCounter {
  private readonly core: GameRuntimeCore;
  private readonly container = new Container({ label: 'MovesCounter' });
  private readonly text: Text;
  private readonly labelText: Text;
  private readonly offResize: () => void;
  private moves = 0;
  private pulseTween: IMotionTween | null = null;
  private fadeTween: IMotionTween | null = null;
  /**
   * Значения, которые обязан применить идущий сейчас твин: прерванный твин
   * своих колбэков не доигрывает, и новый сначала досчитывает за него.
   */
  private pendingValue: { text: string; color: string } | null = null;
  private pendingLabel: string | null = null;

  constructor(core: GameRuntimeCore) {
    this.core = core;
    core.layers.get('TopMenu').addChild(this.container);

    const background = new Sprite(core.textures.get('num'));

    background.scale.set(MOVES_BG_SCALE);
    background.anchor.set(0.5);

    this.moves = useGameStore.getState().movesCount;
    this.text = createRuntimeText(`${this.moves}`, GAME_CONFIG.movesCounterTextConfig);
    this.text.y = MOVES_NUMBER_OFFSET_Y;
    this.labelText = createRuntimeText(movesWord(this.moves), GAME_CONFIG.movesLabelTextConfig);
    this.labelText.y = MOVES_LABEL_OFFSET_Y;
    this.container.addChild(background, this.text, this.labelText);

    this.offResize = core.events.on('resize', this.handleResize);
    this.handleResize(core.viewport);
  }

  private handleResize = ({ width, layout }: IRuntimeViewport): void => {
    this.container.scale.set(layout.scale);
    this.container.position.set(
      width / 2 + width * 0.4,
      layout.top + GAME_CONFIG.topOffset * layout.scale
    );
  };

  /** Мгновенный снап под стор без анимаций: старт партии и «+ходы» near-miss. */
  public updateCount(): void {
    this.moves = useGameStore.getState().movesCount;

    this.stopLabelFade();
    this.stopSpendPulse();

    this.text.text = `${this.moves}`;
    this.text.style.fill = resolveMovesColor(this.moves, NORMAL_MOVES_COLOR, LOW_MOVES_COLOR);
    this.labelText.text = movesWord(this.moves);
  }

  public decreaseCount(): void {
    const previousLabel = movesWord(this.moves);

    useGameStore.getState().decreaseMovesCount();
    this.moves = useGameStore.getState().movesCount;

    const nextLabel = movesWord(this.moves);

    this.playSpendPulse(
      `${this.moves}`,
      resolveMovesColor(this.moves, NORMAL_MOVES_COLOR, LOW_MOVES_COLOR)
    );

    if (nextLabel !== previousLabel) {
      this.playLabelFade(nextLabel);
    }
  }

  private playSpendPulse(nextText: string, nextColor: string): void {
    this.stopSpendPulse();

    this.pendingValue = { text: nextText, color: nextColor };
    this.text.scale.set(1);

    const halfMs = BOARD_TIMING.moves.pulseMs / 2;
    const { motion } = this.core;

    // Часы рантайма напрямую, а не `addDisplayTween`: у того `onComplete`
    // срабатывает и на остановке, а вторая половина пульса должна стартовать
    // только с честного конца первой.
    this.pulseTween = motion.add(
      this.text.scale,
      { x: PULSE_SCALE, y: PULSE_SCALE },
      {
        duration: halfMs,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.applyPendingValue();
          this.pulseTween = motion.add(
            this.text.scale,
            { x: 1, y: 1 },
            {
              duration: halfMs,
              ease: 'Quad.easeIn',
              onComplete: () => {
                this.pulseTween = null;
                this.text.scale.set(1);
              },
            }
          );
        },
      }
    );
  }

  private playLabelFade(nextLabel: string): void {
    this.stopLabelFade();

    this.pendingLabel = nextLabel;

    const { motion } = this.core;

    this.fadeTween = motion.add(
      this.labelText,
      { alpha: 0 },
      {
        duration: BOARD_TIMING.moves.fadeOutMs,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.applyPendingLabel();
          this.fadeTween = motion.add(
            this.labelText,
            { alpha: 1 },
            {
              duration: BOARD_TIMING.moves.fadeInMs,
              ease: 'Quad.easeOut',
              onComplete: () => {
                this.fadeTween = null;
              },
            }
          );
        },
      }
    );
  }

  private applyPendingValue(): void {
    if (!this.pendingValue) {
      return;
    }

    this.text.text = this.pendingValue.text;
    this.text.style.fill = this.pendingValue.color;
    this.pendingValue = null;
  }

  private applyPendingLabel(): void {
    if (this.pendingLabel === null) {
      return;
    }

    this.labelText.text = this.pendingLabel;
    this.pendingLabel = null;
  }

  /** Снимает пульс, досчитывая за него подмену числа и возвращая масштаб. */
  private stopSpendPulse(): void {
    this.pulseTween?.kill();
    this.pulseTween = null;
    this.applyPendingValue();
    this.text.scale.set(1);
  }

  /** Снимает crossfade подписи, досчитывая за него слово и прозрачность. */
  private stopLabelFade(): void {
    this.fadeTween?.kill();
    this.fadeTween = null;
    this.applyPendingLabel();
    this.labelText.alpha = 1;
  }

  public destroy(): void {
    this.offResize();
    this.pulseTween = null;
    this.fadeTween = null;
    this.pendingValue = null;
    this.pendingLabel = null;
    this.container.destroy({ children: true });
  }
}
