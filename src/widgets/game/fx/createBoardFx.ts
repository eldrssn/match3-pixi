import { Graphics, Sprite, type Container } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { CAMERA_FLASH_DEPTH, GOAL_FLIGHT_DEPTH } from '../configs/sceneDepths';
import { BOARD_TIMING } from '../configs/timing';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import { TILE_STEP_X, TILE_STEP_Y } from '../lib/boardGeometry';
import {
  CAMERA_PUNCH,
  clampComboLabel,
  resolveFlashAlpha,
  resolveShakeOffset,
} from '../lib/boardFxRules';
import { createRuntimeText } from '../lib/runtimeText';
import { GAME_TEXTS } from '../texts';
import type { IBoardFx, TCameraPunch } from './boardFx';
import { playBeamStrike, playPortalSweep, playRowsWave } from './boosterFx';
import { FxScene } from './FxScene';
import {
  playAreaBlast,
  playBeamSequence,
  playBoardBlast,
  playColorRays,
  playCrossBlast,
  playLineBlast,
  playPropellerFlight,
  playTakeoff,
} from './specialFx';

/** Насколько темнеет доска на поражении (alpha затемняющего слоя). */
const DEFEAT_DIM_ALPHA = 0.45;

/** Попап «×N»: стартовый масштаб выскока и подъём на угасании, дизайн-px. */
const COMBO_POP_FROM_SCALE = 0.4;
const COMBO_POP_RISE = 44;

/** Сколько летит копия к панели целей и за какой хвост растворяется. */
const GOAL_FLIGHT_MS = 1000;
const GOAL_FLIGHT_FADE_MS = 200;

/**
 * Запас вспышки за краем экрана, доля размера: сцена трясётся вместе со
 * вспышкой, а у эталона вспышка камеры от тряски не зависит - край не должен
 * открываться.
 */
const FLASH_BLEED = 0.05;

/**
 * Эффекты доски на Pixi - реализация `IBoardFx` (фаза 4): частицы
 * (`ParticleLayer` над `ParticleContainer`), тряска и вспышка кадра, лучи
 * ракет, волна бомбы, пропеллер, радуга, эффекты бустеров, попап «×N»,
 * затемнение поражения и полёт копии к цели. Порт `lib/boardFx`,
 * `lib/specialFx`, `lib/boosterFx` и `lib/goalFlight` Phaser-эталона: те же
 * числа, кривые и длительности, поэтому хореография хода, события доски и
 * исход не отличаются от заглушки фазы 2.
 *
 * Всё идёт на часах рантайма (`RuntimeMotion`: твины, задержки и покадровый
 * `onFrame`): пауза действует на эффекты целиком, темп доски - только на
 * твины и задержки. Частицы, тряска и вспышка (`onFrame` без темпа) идут в
 * реальном времени кадра, как эмиттеры и камера эталона. Тряска и
 * вспышка - «камера»: у эталона они на камере сцены и захватывают шапку,
 * здесь - корень сцены (`app.stage`), что то же самое.
 *
 * `piecesLayer` - слой фишек в `container`: хвосты падения ложатся под него.
 */
export const createBoardFx = (
  core: GameRuntimeCore,
  container: Container,
  piecesLayer?: () => Container | undefined
): IBoardFx => {
  const fx = new FxScene(core, container, piecesLayer);
  const stage = core.app.stage;

  // ------------------------------------------------------------- камера

  let shake: { elapsedMs: number; durationMs: number; intensity: number } | null = null;
  let flash: { view: Graphics; elapsedMs: number } | null = null;

  const resetStage = () => {
    if (!stage.destroyed) {
      stage.position.set(0, 0);
    }
  };

  fx.onFrame((deltaMs) => {
    if (shake) {
      shake.elapsedMs += deltaMs;

      if (shake.elapsedMs < shake.durationMs) {
        const offset = resolveShakeOffset(shake.intensity, core.app.screen);

        stage.position.set(offset.x, offset.y);
      } else {
        shake = null;
        resetStage();
      }
    }

    if (flash) {
      flash.elapsedMs += deltaMs;

      if (flash.elapsedMs < BOARD_TIMING.fx.flashMs) {
        flash.view.alpha = resolveFlashAlpha(flash.elapsedMs, BOARD_TIMING.fx.flashMs);
      } else {
        fx.remove(flash.view);
        flash = null;
      }
    }
  });
  fx.onDispose(resetStage);

  // Удар во время удара не перебивает его - как `shake` камеры эталона без `force`.
  const punchCamera = (punch: TCameraPunch) => {
    if (shake || fx.isDestroyed) {
      return;
    }

    shake = { elapsedMs: 0, ...CAMERA_PUNCH[punch] };
  };

  const flashBoard = () => {
    if (flash || fx.isDestroyed) {
      return;
    }

    const { width, height } = core.app.screen;
    const view = new Graphics()
      .rect(
        -width * FLASH_BLEED,
        -height * FLASH_BLEED,
        width * (1 + 2 * FLASH_BLEED),
        height * (1 + 2 * FLASH_BLEED)
      )
      .fill({ color: SKIN.colors.fx.flash });

    view.zIndex = CAMERA_FLASH_DEPTH;
    view.eventMode = 'none';
    flash = { view: fx.add(view, stage), elapsedMs: 0 };
  };

  // -------------------------------------------------------- доска и цели

  const showComboPopup = (x: number, y: number, iteration: number) => {
    if (fx.isDestroyed) {
      return;
    }

    const text = fx.add(
      createRuntimeText(
        GAME_TEXTS.fx.comboMultiplier(clampComboLabel(iteration)),
        GAME_CONFIG.comboTextConfig
      )
    );
    const { comboPopInMs, comboPopHoldMs, comboPopOutMs } = BOARD_TIMING.fx;

    text.position.set(x, y);
    text.scale.set(COMBO_POP_FROM_SCALE);
    fx.tween(text, { scale: 1 }, { duration: comboPopInMs, ease: 'Back.easeOut' });
    fx.tween(
      text,
      { y: y - COMBO_POP_RISE, alpha: 0 },
      {
        delay: comboPopHoldMs,
        duration: comboPopOutMs,
        ease: 'Quad.easeIn',
        onComplete: () => fx.remove(text),
      }
    );
  };

  const dimBoard: IBoardFx['dimBoard'] = async ({ colCount, rowCount }) => {
    const width = colCount * TILE_STEP_X - GAME_CONFIG.tile.size.spaceBetween;
    const height = rowCount * TILE_STEP_Y - GAME_CONFIG.tile.size.spaceBetween;
    const dim = new Graphics().rect(0, 0, width, height).fill({ color: SKIN.colors.fx.dim });

    dim.alpha = 0;
    fx.add(dim);

    await fx.tween(
      dim,
      { alpha: DEFEAT_DIM_ALPHA },
      { duration: BOARD_TIMING.fx.defeatDimMs, ease: 'Sine.easeOut' }
    ).finished;
  };

  /**
   * Копия засчитанного спрайта летит к своей иконке на панели целей и
   * растворяется в ней. Летит в корне сцены над шапкой
   * (`GOAL_FLIGHT_DEPTH`), поэтому стартовые место и масштаб - мировые (с
   * масштабом доски). Без панели - середина верха безопасной зоны.
   */
  const flyToGoalPanel: IBoardFx['flyToGoalPanel'] = (source, texture, target) => {
    if (!source || source.destroyed || fx.isDestroyed) {
      return;
    }

    const world = source.getGlobalTransform();
    const scaleX = Math.hypot(world.a, world.b);
    const scaleY = Math.hypot(world.c, world.d);
    const from = stage.toLocal({ x: world.tx, y: world.ty });
    const to = target
      ? stage.toLocal({ x: target.x, y: target.y })
      : { x: core.app.screen.width / 2, y: core.viewport.layout.top };
    const toScale = target?.scale ?? scaleX;
    const copy = new Sprite(fx.texture(texture));

    copy.anchor.set(0.5);
    copy.position.set(from.x, from.y);
    copy.scale.set(scaleX, scaleY);
    copy.zIndex = GOAL_FLIGHT_DEPTH;
    copy.eventMode = 'none';
    fx.add(copy, stage);

    fx.tween(
      copy,
      { x: to.x, y: to.y, scale: toScale },
      { duration: GOAL_FLIGHT_MS, ease: 'Quad.easeOut', onComplete: () => fx.remove(copy) }
    );
    fx.tween(
      copy,
      { alpha: 0 },
      { delay: GOAL_FLIGHT_MS - GOAL_FLIGHT_FADE_MS, duration: GOAL_FLIGHT_FADE_MS, ease: 'Linear' }
    );
  };

  return {
    emitDestroyBurst: (x, y, tint) => fx.emitBurst(x, y, tint),
    createFallTrail: (rows, startY, tint) => fx.createFallTrail(rows, startY, tint),
    punchCamera,
    flashBoard,
    showComboPopup,
    dimBoard,

    playBeamSequence: (point, angleDeg) => playBeamSequence(fx, point, angleDeg),
    playLineBlast: (at, direction) => playLineBlast(fx, at, direction),
    playCrossBlast: (at, width, bounds) => playCrossBlast(fx, at, width, bounds),
    playAreaBlast: (at, radius) => playAreaBlast(fx, at, radius),
    playTakeoff: (at) => playTakeoff(fx, at),
    playPropellerFlight: (from, to, carried) => playPropellerFlight(fx, from, to, carried),
    playColorRays: (at, targets) => playColorRays(fx, at, targets),
    playBoardBlast: (at, bounds) => playBoardBlast(fx, at, bounds),

    playRowsWave: (ballRow, rows) => playRowsWave(fx, ballRow, rows),
    playBeamStrike: (anchor) => playBeamStrike(fx, anchor),
    playPortalSweep: (anchor) => playPortalSweep(fx, anchor),

    flyToGoalPanel,
    destroy: () => fx.destroy(),
  };
};
