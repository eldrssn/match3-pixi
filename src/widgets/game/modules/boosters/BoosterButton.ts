import { Graphics, Sprite, type Container, type Text } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import { GAME_CONFIG } from '../../configs/GAME_CONFIG';
import type { GameRuntimeCore } from '../../core/GameRuntimeCore';
import { resolveBoosterButtonState } from '../../lib/hudRules';
import { createRuntimeText } from '../../lib/runtimeText';
import { areBoostersHiddenForParty } from '../../model/areBoostersHiddenForParty';
import { addDisplayTween, killDisplayTweens } from '../../motion/displayMotion';
import type { IMotionTween } from '../../motion/RuntimeMotion';
import { useGameStore, type TGameBoosterKind } from '../../store/GameStore';

const BASE_SCALE = GAME_CONFIG.boostersScale;
const OFFSET_Y = GAME_CONFIG.boostersContainerOffsetY;

/** Радиус тёмного кружка под счётчиком и его смещение от центра кнопки. */
const COUNTER_RADIUS = 9;
const COUNTER_OFFSET_X = 22;
const COUNTER_OFFSET_Y = 21;

/** Прозрачность кнопки, у которой кончились заряды. */
const EMPTY_ALPHA = 0.35;

export interface IBoosterButtonConfig {
  /** Вид бустера: по нему кнопка читает остаток и его же шлёт в `boosterStart`. */
  kind: TGameBoosterKind;
  /** Ключ текстуры скина. */
  texture: string;
  /** Смещение кнопки от центра контейнера бустеров, в дизайн-координатах. */
  offsetX: number;
}

/**
 * Кнопка бустера в нижней панели - порт `BoosterButton` Phaser-эталона.
 *
 * Игра только эмитит `boosterStart` с видом бустера, режим выбора цели
 * включает `BoosterMode`/`GameLogic`. Кнопка слушает `boosterEnd` (снять
 * выделение) и `boosterInventoryChanged` (перечитать остаток). Про игровую
 * логику знает одно - занята ли доска (`GameStore.isBoardBusy`, зеркало
 * `GameLogic.isBoardBusy`).
 *
 * Тап - на `pointerdown`, как у эталона: отмену режима ловит `pointerup`
 * корня сцены, и `BoosterMode` подписывается на него с задержкой, чтобы
 * отпускание этого же тапа до него не дошло.
 */
export class BoosterButton {
  private readonly core: GameRuntimeCore;
  private readonly config: IBoosterButtonConfig;
  private readonly image: Sprite;
  private readonly countText: Text;
  private readonly counterBg: Graphics;
  private readonly targetedBg: Sprite;
  private isTargeted = false;
  private idleTargetTween: IMotionTween | null = null;
  private previousQuantity = -1;
  private readonly offInventoryChanged: () => void;
  /** Подписка на `boosterEnd` живёт, пока кнопка выделена. */
  private offBoosterEnd: (() => void) | null = null;

  constructor(core: GameRuntimeCore, parent: Container, config: IBoosterButtonConfig) {
    this.core = core;
    this.config = config;

    const { offsetX, texture } = config;

    this.targetedBg = new Sprite(core.textures.get('targetedBooster'));
    this.targetedBg.scale.set(0.25);
    this.targetedBg.anchor.set(0.5);
    this.targetedBg.position.set(offsetX, OFFSET_Y);
    this.targetedBg.visible = false;

    this.image = new Sprite(core.textures.get(texture));
    this.image.scale.set(BASE_SCALE);
    this.image.anchor.set(0.5);
    this.image.position.set(offsetX, OFFSET_Y);

    const counterX = offsetX + COUNTER_OFFSET_X;
    const counterY = OFFSET_Y + COUNTER_OFFSET_Y;

    this.counterBg = new Graphics()
      .circle(counterX, counterY, COUNTER_RADIUS)
      .fill({ color: SKIN.colors.hud.badge, alpha: 1 });

    const quantity = this.getQuantity();

    this.countText = createRuntimeText(String(quantity), GAME_CONFIG.boosterCountTextConfig);
    this.countText.position.set(counterX, counterY);
    this.previousQuantity = quantity;

    parent.addChild(this.targetedBg, this.image, this.counterBg, this.countText);

    this.image.cursor = 'pointer';
    this.image.on('pointerdown', this.onPointerDown);
    this.offInventoryChanged = core.events.on('boosterInventoryChanged', this.syncState);

    this.applyBoostersVisibility();
  }

  /**
   * Скрытая кнопка не рисуется и не кликается. Видимостью, а не альфой:
   * альфой кнопки владеет `syncState` (притушенная при нулевом остатке).
   */
  private applyBoostersVisibility(): void {
    if (areBoostersHiddenForParty()) {
      this.setPartsVisible(false);
      this.targetedBg.visible = false;
      this.setInteractive(false);

      return;
    }

    this.setPartsVisible(true);
    this.syncState();
  }

  private setPartsVisible(isVisible: boolean): void {
    this.image.visible = isVisible;
    this.countText.visible = isVisible;
    this.counterBg.visible = isVisible;
  }

  private setInteractive(isInteractive: boolean): void {
    this.image.eventMode = isInteractive ? 'static' : 'none';
  }

  private getQuantity(): number {
    return useGameStore.getState().getBoosterQuantity(this.config.kind);
  }

  private onPointerDown = (): void => {
    if (areBoostersHiddenForParty()) {
      return;
    }

    this.select();
  };

  private select(): void {
    if (this.getQuantity() <= 0) {
      return;
    }

    // Доска занята каскадом - новый бустер начинать нельзя.
    if (useGameStore.getState().isBoardBusy) {
      return;
    }

    if (this.isTargeted) {
      return;
    }

    const { motion, events } = this.core;

    this.isTargeted = true;
    this.targetedBg.alpha = 0;
    this.targetedBg.visible = true;
    addDisplayTween(motion, this.targetedBg, { alpha: 1 }, { duration: 100 });
    this.idleTargetTween = addDisplayTween(
      motion,
      this.image,
      { scale: BASE_SCALE * 1.2 },
      { duration: 1000, yoyo: true, repeat: -1 }
    );
    this.offBoosterEnd = events.on('boosterEnd', this.handleBoosterEnd);
    events.emit('boosterStart', this.config.kind);
  }

  private handleBoosterEnd = (): void => {
    if (!this.isTargeted) {
      return;
    }

    this.isTargeted = false;
    this.idleTargetTween?.kill();
    this.idleTargetTween = null;
    killDisplayTweens(this.core.motion, this.targetedBg);
    this.image.scale.set(BASE_SCALE);
    this.targetedBg.alpha = 0;
    this.targetedBg.visible = false;
    this.offBoosterEnd?.();
    this.offBoosterEnd = null;
  };

  private syncState = (): void => {
    const quantity = this.getQuantity();
    const { motion } = this.core;

    this.countText.text = String(quantity);

    if (this.previousQuantity !== quantity) {
      this.previousQuantity = quantity;
      addDisplayTween(
        motion,
        this.countText,
        { scale: 1.3 },
        {
          duration: 100,
          yoyo: true,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!this.countText.destroyed) {
              this.countText.scale.set(1);
            }
          },
        }
      );
    }

    const state = resolveBoosterButtonState(quantity, areBoostersHiddenForParty());

    if (state.isDimmed) {
      addDisplayTween(motion, this.image, { alpha: EMPTY_ALPHA }, { duration: 100 });
    }

    this.setInteractive(state.isInteractive);
  };

  /**
   * Снимает подписки. Спрайты гасит контейнер панели (`BoostersContainer`),
   * твины - часы рантайма, погашенные раньше модулей.
   */
  public destroy(): void {
    this.idleTargetTween = null;
    this.offInventoryChanged();
    this.offBoosterEnd?.();
    this.offBoosterEnd = null;

    if (!this.image.destroyed) {
      this.image.off('pointerdown', this.onPointerDown);
    }
  }
}
