import { Container, Graphics } from 'pixi.js';
import { SKIN, skinTextureWidth } from '@/entities/skin';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { BOARD_TIMING } from '../configs/timing';
import { cellCenter } from '../lib/boardGeometry';
import type { IBoosterFxAnchor } from './boardFx';
import type { FxScene } from './FxScene';

/**
 * Эффекты бустеров: «шар» (волна по строкам), «луч» по клетке и «лазер» -
 * порталы над фишкой. Порт `lib/boosterFx` Phaser-эталона число в число;
 * масштабы - дробью «дизайн-px эффекта / ширина его текстуры».
 */

/** `wave`: волна шире доски; светлая полоса - в строку. */
const WAVE_SCALE = 703 / skinTextureWidth('wave');
/** `boosterBall`: шар, который ведёт волну по строке. */
const BALL_SCALE = 64 / skinTextureWidth('boosterBall');

/** Волна и шар заходят из-за левого края доски. */
const WAVE_START_X = -200;
const BALL_START_X = -100;
/** Шар уходит за правый край сцены на столько дизайн-px. */
const BALL_EXIT_OVERSHOOT = 100;
/** Покачивание шара по вертикали на пролёте. */
const BALL_BOB_Y = 30;
const BALL_BOB_MS = 400;

const FLIGHT_MS = 2000;
/** Волна раскрывается за шаром быстрее, чем он долетает до края. */
const WAVE_REVEAL_MS = 900;
/** Видимая с первого кадра часть волны, пиксели текстуры. */
const WAVE_REVEAL_FROM = 80;
/** Запас обрезки поверх раскрытой ширины, пиксели текстуры. */
const WAVE_REVEAL_PAD = 10;
/** Волны вместе дрейфуют назад: «шлейф» отстаёт от шара. */
const WAVE_DRIFT_X = -200;
const FADE_MS = 500;
/** Сколько проигрыватель ждёт пролёта, прежде чем нанести урон. */
export const ROWS_WAVE_PLAY_MS = 2200;

/**
 * Видимая ширина волны в дизайн-px по ширине обрезки в пикселях текстуры
 * (`setCrop` эталона режет кадр слева направо, не шире самой текстуры).
 */
const revealDesignWidth = (cropPx: number, textureWidth: number): number =>
  Math.max(1, Math.min(textureWidth, cropPx)) * WAVE_SCALE;

/**
 * Пролёт шара: волна на каждой строке из `rows`, шар по строке `ballRow`.
 * Волны идут вровень - три строки читаются одной полосой урона.
 */
export const playRowsWave = async (
  fx: FxScene,
  ballRow: number,
  rows: readonly number[]
): Promise<void> => {
  const ballY = cellCenter({ col: 0, row: ballRow }).y;
  const textureWidth = fx.texture('wave').width;

  // Волны - в своём контейнере: дрейф назад одним твином на все строки.
  const waveContainer = fx.add(new Container({ label: 'fxRowsWave' }));
  const waves = rows.map((row) => {
    const wave = fx.sprite('wave', WAVE_START_X, cellCenter({ col: 0, row }).y);

    wave.anchor.set(0, 0.5);
    wave.scale.set(WAVE_SCALE);
    waveContainer.addChild(wave);

    return wave;
  });
  // Обрезка слева направо - замена `setCrop` эталона: маска-полоса от левого
  // края волн, её ширину ведёт раскрытие. Полоса единичной ширины
  // растягивается масштабом, а не перерисовывается каждый кадр; по высоте
  // она с запасом накрывает все строки.
  const waveTop = Math.min(...waves.map((wave) => wave.y - wave.height / 2));
  const waveBottom = Math.max(...waves.map((wave) => wave.y + wave.height / 2));
  const reveal = new Graphics()
    .rect(0, waveTop, 1, waveBottom - waveTop)
    .fill({ color: SKIN.colors.fx.flash });

  reveal.x = WAVE_START_X;
  waveContainer.addChild(reveal);
  waveContainer.mask = reveal;

  const ball = fx.sprite('boosterBall', BALL_START_X, ballY);

  ball.scale.set(BALL_SCALE);
  // Хвост кладётся в контейнер раньше шара: он идёт под шаром.
  const trail = fx.createFlightTrail(ball);

  fx.add(ball);

  const bob = fx.tween(
    ball,
    { y: ballY - BALL_BOB_Y },
    { duration: BALL_BOB_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }
  );
  const revealed = { width: WAVE_REVEAL_FROM };
  const setRevealCrop = (cropPx: number) => {
    if (!reveal.destroyed) {
      reveal.scale.x = revealDesignWidth(cropPx, textureWidth);
    }
  };

  setRevealCrop(1);
  fx.tweenValue(
    revealed,
    { width: textureWidth },
    {
      duration: WAVE_REVEAL_MS,
      ease: 'Sine.easeIn',
      onUpdate: () => setRevealCrop(revealed.width + WAVE_REVEAL_PAD),
    }
  );
  fx.tween(waveContainer, { x: WAVE_DRIFT_X }, { duration: FLIGHT_MS, ease: 'Linear' });

  // Шар живёт в контейнере доски, а тот сдвинут и отмасштабирован: правый
  // край сцены переводится в его координаты.
  const exitX = fx.container.toLocal({ x: fx.core.app.screen.width, y: 0 }, fx.core.app.stage).x;

  fx.tween(
    ball,
    { x: exitX + BALL_EXIT_OVERSHOOT },
    {
      duration: FLIGHT_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        setRevealCrop(textureWidth);
        // Хвост доживает своим сроком, затухание - только у волн и шара.
        trail.stop();
        bob.kill();

        const fades = [...waves, ball].map(
          (display) =>
            fx.tween(display, { alpha: 0 }, { duration: FADE_MS, ease: 'Linear' }).finished
        );

        void Promise.all(fades).then(() => {
          fx.remove(ball);
          // Контейнер волн заводится на каждый пролёт - и снимается с ним.
          fx.remove(waveContainer);
        });
      },
    }
  );

  await fx.motion.delay(ROWS_WAVE_PLAY_MS);
};

/** `light`: луч перекрывает доску по диагонали. */
const BEAM_SCALE = 477 / skinTextureWidth('light');
/** `ellipse`: кольца, вылетающие следом за лучом - своя дробь, а не общий с лучом множитель. */
const ELLIPSE_SCALE = 78 / skinTextureWidth('ellipse');
/** `portal`: звезда бустера «лазер» над каждой снятой фишкой. */
const PORTAL_SCALE = 84 / skinTextureWidth('portal');
/** Куда улетает кольцо луча (вдоль диагонали вверх-вправо), дизайн-px. */
const ELLIPSE_FLIGHT = 300;
/** Сколько колец уходит вдоль луча. */
const BEAM_ELLIPSE_COUNT = 3;
/** Задняя звезда портала повёрнута и полупрозрачна. */
const PORTAL_BACK_ANGLE = 90;
const PORTAL_BACK_ALPHA = 0.6;

const playBeamEllipse = async (
  fx: FxScene,
  { x, y, angle }: IBoosterFxAnchor,
  delayMs: number
): Promise<void> => {
  const ellipse = fx.add(fx.sprite('ellipse', x, y));

  ellipse.alpha = 0;
  ellipse.scale.set(ELLIPSE_SCALE);
  ellipse.angle = angle;

  if (delayMs > 0) {
    await fx.motion.delay(delayMs);
  }

  await fx.tween(ellipse, { alpha: 1 }, { duration: BOARD_TIMING.booster.ellipseFadeInMs })
    .finished;
  await fx.tween(
    ellipse,
    {
      x: x + ELLIPSE_FLIGHT,
      y: y - ELLIPSE_FLIGHT,
      scale: ELLIPSE_SCALE / 2,
      alpha: 0.3,
    },
    { duration: BOARD_TIMING.booster.ellipseFlightMs, ease: 'Sine.easeIn' }
  ).finished;

  fx.remove(ellipse);
};

/** Бустер «луч» по клетке: диагональный луч и три кольца, уходящие вдоль него. */
export const playBeamStrike = async (fx: FxScene, anchor: IBoosterFxAnchor): Promise<void> => {
  const { x, y, angle } = anchor;
  const light = fx.add(
    fx.sprite('light', x - GAME_CONFIG.tile.size.width / 2, y + GAME_CONFIG.tile.size.height / 2)
  );

  light.alpha = 0;
  light.anchor.set(0, 1);
  light.scale.set(BEAM_SCALE);
  light.angle = angle;

  const { beamFadeInMs, beamHoldMs, beamFadeOutMs, ellipseStaggerMs } = BOARD_TIMING.booster;

  await fx.tween(light, { alpha: 1 }, { duration: beamFadeInMs }).finished;

  for (let index = 0; index < BEAM_ELLIPSE_COUNT; index += 1) {
    void playBeamEllipse(fx, anchor, index * ellipseStaggerMs);
  }

  await fx.motion.delay(beamHoldMs);
  await fx.tween(light, { alpha: 0 }, { duration: beamFadeOutMs }).finished;

  fx.remove(light);
};

/** Бустер «лазер» над фишкой цвета: две встречно вращающиеся звезды-портала. */
export const playPortalSweep = async (
  fx: FxScene,
  { x, y, angle }: IBoosterFxAnchor
): Promise<void> => {
  const front = fx.add(fx.sprite('portal', x, y));
  // Задняя кладётся второй, как у эталона: глубина внутри контейнера у
  // Phaser не работает, и рисуется она поверх передней.
  const back = fx.add(fx.sprite('portal', x, y));

  front.scale.set(0);
  front.angle = angle;
  back.scale.set(0);
  back.angle = angle + PORTAL_BACK_ANGLE;
  back.alpha = PORTAL_BACK_ALPHA;

  const { portalGrowMs, portalSpinMs, portalFadeOutMs } = BOARD_TIMING.booster;

  await Promise.all(
    [front, back].map(
      (portal) =>
        fx.tween(portal, { scale: PORTAL_SCALE }, { duration: portalGrowMs, ease: 'Back.easeOut' })
          .finished
    )
  );

  fx.tween(front, { angle: front.angle + 360 }, { duration: portalSpinMs, ease: 'Linear' });
  fx.tween(back, { angle: back.angle - 360 }, { duration: portalSpinMs, ease: 'Linear' });

  await fx.motion.delay(portalSpinMs);

  await Promise.all(
    [front, back].map(
      (portal) =>
        fx.tween(portal, { alpha: 0, scale: 0 }, { duration: portalFadeOutMs, ease: 'Linear' })
          .finished
    )
  );

  fx.remove(front);
  fx.remove(back);
};
