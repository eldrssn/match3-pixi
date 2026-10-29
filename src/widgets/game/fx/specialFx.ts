import { Graphics } from 'pixi.js';
import type { IBoardCellPos, TBoardPiece } from '@/entities/game';
import {
  getElementTexture,
  ROCKET_BEAM_FRAME_COUNT,
  SKIN,
  skinTextureWidth,
} from '@/entities/skin';
import { CELL_TEXTURE_WIDTH } from '../configs/GAME_CONFIG';
import { BOARD_TIMING } from '../configs/timing';
import { cellCenter, TILE_STEP_X, type IBoardPoint } from '../lib/boardGeometry';
import { listCrossBeams, resolveFlightPoint, resolveRingScale } from '../lib/boardFxRules';
import { resolvePropellerFlightMs } from '../lib/boardTempo';
import type { IBoardBounds } from './boardFx';
import type { FxScene } from './FxScene';

/**
 * Взрывы спецфишек: лучи ракет, ударная волна бомбы, взлёт и полёт
 * пропеллера, лучи радуги - порт `lib/specialFx` Phaser-эталона число в число.
 * Всё рисуется в контейнере доски, в её дизайн-координатах; урон идёт
 * следующим шагом, поэтому промисы ждут ровно эталонное время.
 *
 * Масштабы - дробью «дизайн-px / ширина текстуры» (знаменатель - из скина).
 */

/** Кадры секвенции луча (`laser1`..`laserN`): луч шире доски с запасом. */
const BEAM_TEXTURE_SCALE = 430 / skinTextureWidth('laser1');
/** Лучи расходятся из клетки с небольшим зазором от её центра. */
const BEAM_GAP = 10;

const RING_TEXTURE_WIDTH = skinTextureWidth('ellipse');
/** Стартовый масштаб кольца - точка в центре клетки. */
const RING_START_SCALE = 0.05;

/** Пропеллер в полёте чуть крупнее себя на доске (44 дизайн-px). */
const FLIGHT_PROPELLER_SCALE = 52 / CELL_TEXTURE_WIDTH;
/** Иконка несомой спецфишки под пропеллером - текстура покоя этой спецфишки. */
const CARRIED_ICON: Partial<Record<TBoardPiece['id'], { texture: string; scale: number }>> = {
  laser: { texture: getElementTexture('laser'), scale: 28 / CELL_TEXTURE_WIDTH },
  bomb: { texture: getElementTexture('bomb'), scale: 28 / CELL_TEXTURE_WIDTH },
};
/** Иконка несомой спецфишки висит под пропеллером. */
const CARRIED_ICON_OFFSET_Y = 12;
const FLIGHT_FADE_MS = 120;

/** Толщина луча радуги, дизайн-px. */
const RAY_WIDTH = 4;

/** Два луча из точки в противоположные стороны по оси `angleDeg` - кадры `laser1..N`. */
export const playBeamSequence = async (
  fx: FxScene,
  { x, y }: IBoardPoint,
  angleDeg: number
): Promise<void> => {
  const angle = (angleDeg * Math.PI) / 180;
  const gapX = Math.cos(angle) * BEAM_GAP;
  const gapY = Math.sin(angle) * BEAM_GAP;
  const forward = fx.add(fx.sprite('laser1', x + gapX, y + gapY));
  // Отрицательный масштаб по X - зеркало: тот же кадр в другую сторону.
  const backward = fx.add(fx.sprite('laser1', x - gapX, y - gapY));

  [forward, backward].forEach((beam) => {
    beam.anchor.set(0, 0.5);
    beam.angle = angleDeg;
  });
  forward.scale.set(BEAM_TEXTURE_SCALE);
  backward.scale.set(-BEAM_TEXTURE_SCALE, BEAM_TEXTURE_SCALE);

  for (let frame = 1; frame <= ROCKET_BEAM_FRAME_COUNT; frame++) {
    if (forward.destroyed || backward.destroyed) {
      return;
    }

    const texture = fx.texture(`laser${frame}`);

    forward.texture = texture;
    backward.texture = texture;

    await fx.motion.delay(BOARD_TIMING.special.beamFrameMs);
  }

  fx.remove(forward);
  fx.remove(backward);
};

/** Ракета без своего спрайта: луч по строке или колонке через клетку. */
export const playLineBlast = (
  fx: FxScene,
  at: IBoardCellPos,
  direction: 'horizontal' | 'vertical'
): Promise<void> => playBeamSequence(fx, cellCenter(at), direction === 'horizontal' ? 0 : 90);

/** Строки и колонки через клетку одним залпом; линии за краем поля не рисуются. */
export const playCrossBlast = async (
  fx: FxScene,
  at: IBoardCellPos,
  width: number,
  bounds: IBoardBounds
): Promise<void> => {
  await Promise.all(
    listCrossBeams(at, width, bounds).map(({ point, angleDeg }) =>
      playBeamSequence(fx, point, angleDeg)
    )
  );
};

const playRing = async (
  fx: FxScene,
  center: IBoardPoint,
  diameter: number,
  tint: number,
  durationMs: number
): Promise<void> => {
  const ring = fx.add(fx.sprite('ellipse', center.x, center.y));

  ring.scale.set(RING_START_SCALE);
  ring.tint = tint;

  await fx.tween(
    ring,
    { scale: resolveRingScale(diameter, RING_TEXTURE_WIDTH), alpha: 0 },
    { duration: durationMs, ease: 'Cubic.easeOut' }
  ).finished;

  fx.remove(ring);
};

/** Бомба: кольцо ударной волны до края зоны и сноп искр в центре. */
export const playAreaBlast = async (
  fx: FxScene,
  at: IBoardCellPos,
  radius: number
): Promise<void> => {
  const center = cellCenter(at);

  fx.emitBurst(center.x, center.y, SKIN.colors.fx.shockwave);
  fx.emitBurst(center.x, center.y, SKIN.colors.fx.blastSpark);

  await playRing(
    fx,
    center,
    (2 * radius + 1) * TILE_STEP_X,
    SKIN.colors.fx.shockwave,
    BOARD_TIMING.special.shockwaveMs
  );
};

/** Взлёт пропеллера: короткое кольцо по кресту из его клетки и соседей. */
export const playTakeoff = (fx: FxScene, at: IBoardCellPos): Promise<void> =>
  playRing(
    fx,
    cellCenter(at),
    3 * TILE_STEP_X,
    SKIN.colors.fx.takeoff,
    BOARD_TIMING.special.takeoffMs
  );

/**
 * Полёт пропеллера дугой к цели, с хвостом и иконкой несомой спецфишки.
 * Промис - до прилёта: удар по цели идёт следующим шагом, а пропеллер гаснет
 * уже поверх него.
 */
export const playPropellerFlight = async (
  fx: FxScene,
  from: IBoardCellPos,
  to: IBoardCellPos,
  carried: TBoardPiece['id'] | null
): Promise<void> => {
  const start = cellCenter(from);
  const end = cellCenter(to);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const propeller = fx.sprite(getElementTexture('propeller'), start.x, start.y);
  const iconConfig = carried ? CARRIED_ICON[carried] : undefined;
  const icon = iconConfig ? fx.sprite(iconConfig.texture, start.x, start.y) : null;

  propeller.scale.set(FLIGHT_PROPELLER_SCALE);
  icon?.scale.set(iconConfig?.scale ?? 1);

  // Хвост - до пропеллера: порядок в контейнере - порядок отрисовки.
  const trail = fx.createFlightTrail(propeller);

  if (icon) {
    fx.add(icon);
  }

  fx.add(propeller);

  const progress = { t: 0 };

  await fx.tweenValue(
    progress,
    { t: 1 },
    {
      duration: resolvePropellerFlightMs(distance / TILE_STEP_X),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (propeller.destroyed) {
          return;
        }

        const point = resolveFlightPoint(start, end, progress.t);

        propeller.position.set(point.x, point.y);
        icon?.position.set(point.x, point.y + CARRIED_ICON_OFFSET_Y);
      },
    }
  ).finished;

  trail.stop();

  if (fx.isDestroyed) {
    return;
  }

  fx.emitBurst(end.x, end.y, SKIN.colors.fx.takeoff);

  [propeller, icon].forEach((display) => {
    if (display) {
      fx.tween(
        display,
        { alpha: 0 },
        { duration: FLIGHT_FADE_MS, onComplete: () => fx.remove(display) }
      );
    }
  });
};

/** Радуга: разноцветные лучи к каждой фишке её цвета, гаснущие разом. */
export const playColorRays = async (
  fx: FxScene,
  at: IBoardCellPos,
  targets: readonly IBoardCellPos[]
): Promise<void> => {
  if (targets.length === 0) {
    return;
  }

  const origin = cellCenter(at);
  const rays = new Graphics();
  const palette = SKIN.colors.rainbow;

  targets.forEach((target, index) => {
    const end = cellCenter(target);

    rays
      .moveTo(origin.x, origin.y)
      .lineTo(end.x, end.y)
      .stroke({ width: RAY_WIDTH, color: palette[index % palette.length] });
  });

  fx.add(rays);

  await fx.tween(rays, { alpha: 0 }, { duration: BOARD_TIMING.special.raysMs, ease: 'Quad.easeIn' })
    .finished;

  fx.remove(rays);
};

/** Радуга+радуга: ударная волна через всё поле. */
export const playBoardBlast = (
  fx: FxScene,
  at: IBoardCellPos,
  { colCount, rowCount }: IBoardBounds
): Promise<void> => playAreaBlast(fx, at, Math.max(colCount, rowCount));
