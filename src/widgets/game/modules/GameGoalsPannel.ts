import { Container, Graphics, Sprite, type Text } from 'pixi.js';
import { findElementTexture, SKIN, skinTextureWidth } from '@/entities/skin';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { GOAL_PANEL_LAYER_DEPTH } from '../configs/sceneDepths';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport } from '../core/RuntimeEvents';
import type { IGoalFlightTarget } from '../fx/boardFx';
import { resolveGoalSlotsX } from '../lib/hudRules';
import { createRuntimeText } from '../lib/runtimeText';
import { addDisplayTween, killDisplayTweens } from '../motion/displayMotion';
import { useGameStore } from '../store/GameStore';
import { GAME_TEXTS } from '../texts';
import { BASE_SCALE } from './cells/BoardEntity';
import { GoalIntro } from './GoalIntro';

/** Радиус кружка под остатком цели. */
const BADGE_RADIUS = 9;

/** Порядок контейнера внутри слоя панели (`TopMenuCenter`), как у эталона. */
const PANEL_CONTAINER_DEPTH = 10001;

/**
 * Иконка цели - текстура покоя элемента из скина, в размер фишки. Масштаб -
 * «дизайн-px клетки / ширина текстуры». Чужой код (уровень его не пропустит
 * валидация) - текстура под самим кодом и масштаб фишки.
 */
const resolveGoalIcon = (goalId: string): { texture: string; scale: number } => {
  const texture = findElementTexture(goalId);

  return texture
    ? { texture, scale: GAME_CONFIG.cellsSize / skinTextureWidth(texture) }
    : { texture: goalId, scale: BASE_SCALE };
};

interface IGoalItem {
  image: Sprite;
  current: number;
  text: Text;
}

/**
 * Панель целей в шапке: плашка, иконки целей с остатком и подпись «Цель».
 * Порт `GameGoalsPannel` Phaser-эталона: та же геометрия в дизайн-px, тот же
 * пульс цифры и иконки на засчитанной цели, то же интро (`GoalIntro`).
 *
 * Собирает панель `init()` (`GameLogic.initStates` -> `IBoardHud.init`) -
 * когда цели уровня уже лежат в сторе.
 */
export class GameGoalsPannel {
  private readonly core: GameRuntimeCore;
  private readonly layer: Container;
  private readonly container = new Container({ label: 'GoalsPanel' });
  private goalPannelImage: Sprite | null = null;
  private readonly goalItems = new Map<string, IGoalItem>();
  private readonly designY = GAME_CONFIG.topOffset;
  private readonly offResize: () => void;

  /** Интро доиграно: панель живёт по resize. До этого её ведёт интро. */
  private isAnimationComplete = false;
  private isInitialized = false;
  private readonly intro: GoalIntro;

  constructor(core: GameRuntimeCore) {
    this.core = core;
    this.layer = core.layers.get('TopMenuCenter');
    this.layer.addChild(this.container);

    this.intro = new GoalIntro(core, {
      container: this.container,
      getPanelWidth: () => (this.goalPannelImage ? this.goalPannelImage.width : 1),
      getFinalPosition: () => this.resolveFinalPosition(this.core.viewport),
      onFinished: () => {
        this.isAnimationComplete = true;
        this.applyResize(this.core.viewport);
      },
    });

    this.offResize = core.events.on('resize', this.handleResize);
  }

  public init(): void {
    if (this.isInitialized) {
      return;
    }

    const { tile } = GAME_CONFIG;
    const spacing = tile.size.spaceBetween + tile.size.width;
    const goals = useGameStore.getState().goals;

    // Целей нет - панель не собираем: повторный вызов с целями должен пройти.
    if (goals.length === 0) {
      return;
    }

    this.isInitialized = true;

    const { textures } = this.core;
    const panel = new Sprite(textures.get('goalPannel'));

    panel.scale.set(0.25);
    panel.anchor.set(0.5);
    panel.y = GAME_CONFIG.topOffset / 2 - 7;
    this.container.addChild(panel);
    this.goalPannelImage = panel;

    const slots = resolveGoalSlotsX(goals.length, spacing);
    const badgeOffset = tile.size.width / 2;

    goals.forEach((goal, index) => {
      const icon = resolveGoalIcon(goal.id);
      const image = new Sprite(textures.get(icon.texture));
      const x = slots[index] ?? 0;

      image.scale.set(icon.scale);
      image.anchor.set(0.5);
      image.position.set(x, 7);

      const badgeX = x + badgeOffset - 10;
      const badgeY = badgeOffset - 5;
      const badge = new Graphics()
        .circle(badgeX, badgeY, BADGE_RADIUS)
        .fill({ color: SKIN.colors.hud.badge, alpha: 1 });
      const text = createRuntimeText(
        `${goal.target - goal.current}`,
        GAME_CONFIG.boosterCountTextConfig
      );

      text.position.set(badgeX, badgeY);
      this.container.addChild(image, badge, text);
      this.goalItems.set(goal.id, { image, current: goal.current, text });
    });

    const title = createRuntimeText(GAME_TEXTS.hud.goalTitle, GAME_CONFIG.boosterCountTextConfig);

    title.position.set(0, 41);
    this.container.addChild(title);
  }

  private handleResize = (viewport: IRuntimeViewport): void => {
    if (!this.isAnimationComplete) {
      return;
    }

    this.applyResize(viewport);
  };

  private applyResize(viewport: IRuntimeViewport): void {
    const { scale, x, y } = this.resolveFinalPosition(viewport);

    this.container.scale.set(scale);
    this.container.position.set(x, y);
  }

  /**
   * Куда лететь копии засчитанного элемента: иконка этой цели в координатах
   * сцены и её мировой масштаб. Масштаб - покоя, а не текущий спрайта: иконка
   * может быть на середине пульса. Слои и корень сцены не масштабируются,
   * поэтому мировой масштаб панели - её собственный.
   */
  public getGoalTarget(goalId: string): IGoalFlightTarget | null {
    const icon = this.goalItems.get(goalId)?.image;

    if (!icon || icon.destroyed) {
      return null;
    }

    const { x, y } = icon.getGlobalPosition();

    return { x, y, scale: this.container.scale.x * resolveGoalIcon(goalId).scale };
  }

  /** Единственный расчёт места панели: его же берёт интро как точку прилёта. */
  private resolveFinalPosition({ width, layout }: IRuntimeViewport) {
    return {
      scale: layout.scale,
      x: width / 2,
      y: layout.top + this.designY * layout.scale,
    };
  }

  public async playIntroHold(): Promise<void> {
    // Панели нет (уровень без целей) - интро не запускается вовсе.
    if (!this.isInitialized) {
      this.isAnimationComplete = true;
      this.applyResize(this.core.viewport);

      return;
    }

    // Панель обязана оказаться над затемнением интро.
    this.layer.zIndex = GOAL_PANEL_LAYER_DEPTH;
    this.container.zIndex = PANEL_CONTAINER_DEPTH;

    await this.intro.playHold();
  }

  public async playIntroOutro(): Promise<void> {
    await this.intro.playOutro();
  }

  public updateGoals(): void {
    const { goals } = useGameStore.getState();

    goals.forEach((goal) => {
      const item = this.goalItems.get(goal.id);

      if (!item) {
        console.warn(`Goal with id "${goal.id}" not found in goalItems`);

        return;
      }

      const hasChanged = item.current !== goal.current;

      item.current = goal.current;
      item.text.text = `${Math.max(0, goal.target - goal.current)}`;
      item.text.style.fill = goal.isCompleted
        ? SKIN.colors.hud.goalDoneText
        : SKIN.colors.hud.goalText;

      if (hasChanged) {
        this.pulse(item.text, 1, 1.3, 'Back.easeOut');
        this.pulse(item.image, resolveGoalIcon(goal.id).scale, 1.2);
      }
    });
  }

  /**
   * Пульс на засчитанной цели. Батчи урона идут чаще, чем длится пульс, поэтому
   * прошлый твин снимается, а масштаб возвращается к базовому до нового.
   */
  private pulse(display: Container, baseScale: number, factor: number, ease?: string): void {
    const { motion } = this.core;

    killDisplayTweens(motion, display);
    display.scale.set(baseScale);
    addDisplayTween(
      motion,
      display,
      { scale: baseScale * factor },
      {
        duration: 100,
        yoyo: true,
        ease,
        onComplete: () => {
          if (!display.destroyed) {
            display.scale.set(baseScale);
          }
        },
      }
    );
  }

  public destroy(): void {
    this.offResize();
    // Раньше контейнера: интро отпускает своё ожидание и снимает затемнение.
    this.intro.destroy();
    this.container.destroy({ children: true });
  }
}
