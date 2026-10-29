import { getElementHitSound, SKIN, type TSoundCue } from '@/entities/skin';
import type { IBoardHit, IBoardSpecialPlacement, TBoardBlast } from '@/entities/game';
import { BOARD_TIMING } from '../../configs/timing';
import { resolveCascadeIterationDelayMs, resolveFallDelayMs } from '../../lib/boardTempo';
import { DropEntity } from '../cells/DropEntity';
import { LaserEntity } from '../cells/LaserEntity';
import { SlimeEntity } from '../cells/SlimeEntity';
import type { IStepAnimationContext, TStepAnimations } from './stepAnimationTypes';

/**
 * Анимации шагов протокола хода по умолчанию - по функции на вид шага
 * (`TBoardStep['type']`). Решений здесь нет: что разрушить, куда упасть и
 * какого цвета добор, движок уже записал в шаг; анимация только показывает
 * его и держит грид спрайтов в такт (`IStepBoard`).
 *
 * Хореография - та же, что у Phaser-эталона, число в число: что ждётся, что
 * играет параллельно и сколько (`BOARD_TIMING`, `lib/boardTempo`). Картинка
 * эффектов - `context.fx` (`IBoardFx`).
 *
 * Свои анимации копия проекта добавляет не здесь, а в
 * `stepAnimationOverrides.ts`: переопределение получает эту функцию как
 * `playDefault`.
 */

/**
 * Пауза между запуском дестроя и стартом падения (см.
 * `BOARD_TIMING.destroy.barrierMs`). Урон не ждёт анимаций (см. `damage`), и
 * без барьера падающая фишка въезжала бы в клетку в тот же кадр, когда прежняя
 * ещё догорает на полный рост.
 */
const DESTROY_BARRIER_MS = BOARD_TIMING.destroy.barrierMs;

/**
 * Сколько длится пересчёт оставшихся ходов в бонус целиком: на десяти ходах
 * счётчик тикает быстро, на двух - не растягивается.
 */
const BONUS_COUNTDOWN_MS = 600;
const BONUS_TICK_MAX_MS = 90;

/** Звук взрыва по его виду: полёт пропеллера - свист, комбинации линий - ракета. */
const BLAST_SOUND: Record<TBoardBlast['kind'], TSoundCue> = {
  line: 'rocket',
  cross: 'rocket',
  area: 'bomb',
  takeoff: 'propeller',
  flight: 'shuffle',
  color: 'rainbow',
  board: 'mega',
};

/** Звук удара - из описания элемента в скине: треск у блокеров и накладок. */
const playHitSound = ({ sound }: IStepAnimationContext, id: string): void => {
  const cue = getElementHitSound(id);

  if (cue) {
    sound?.play(cue);
  }
};

const hitPiece = (context: IStepAnimationContext, hit: IBoardHit): void => {
  const entity = context.board.entity(hit.uid);

  if (!entity) {
    return;
  }

  playHitSound(context, entity.id);
  entity.takeDamage(hit.hp);

  if (hit.destroyed) {
    context.board.detach(hit.uid);
  }
};

/** Удар по накладке или подложке: стадия слоя или его разрушение. */
const hitLayer = (context: IStepAnimationContext, hit: IBoardHit): void => {
  const layer = context.board.layer(hit.uid);

  if (!layer) {
    return;
  }

  playHitSound(context, layer.id);
  layer.takeDamage(hit.hp);

  if (hit.destroyed) {
    context.board.forgetLayer(hit.uid);
  }
};

/**
 * Появление спец-элемента - собственная фаза, а не тихая запись в грид:
 * заработанная награда - пиковый момент хода.
 *
 * Не ожидается намеренно. Спецфишка рождается в клетке фигуры, которая в этот
 * момент никуда не едет, поэтому её выскок доигрывает поверх осыпания доски -
 * как попап «×N» - и не добавляет к ходу ни миллисекунды.
 */
const spawnSpecial = ({ fx, board }: IStepAnimationContext, placement: IBoardSpecialPlacement) => {
  const special = board.spawn(placement.piece, placement.col, placement.row);

  special.playSpawnPop();

  const { visualX, visualY } = special.getVisualCoords();

  fx.emitDestroyBurst(visualX, visualY, SKIN.colors.fx.specialSpawn);
  fx.punchCamera('strike');
};

/** Анимация взрыва одного вида: `uid` - паспорт сдетонировавшей спецфишки. */
type TBlastAnimation<K extends TBoardBlast['kind']> = (
  context: IStepAnimationContext,
  uid: number,
  blast: Extract<TBoardBlast, { kind: K }>
) => Promise<void>;

/**
 * Взрыв спецфишки или комбинации по его виду - только анимация: урон по
 * клеткам идёт следующим шагом. Камера отвечает в момент удара, а сила - по
 * масштабу взрыва.
 */
const BLAST_ANIMATIONS: { readonly [K in TBoardBlast['kind']]: TBlastAnimation<K> } = {
  line: async ({ fx, board }, uid, blast) => {
    const entity = board.entity(uid);

    // Ракета на своей клетке стреляет своим спрайтом; несомая пропеллером
    // или превращённая радугой - лучом без спрайта.
    if (entity instanceof LaserEntity && entity.x === blast.at.col && entity.y === blast.at.row) {
      await entity.laserAnimate();
    } else {
      await fx.playLineBlast(blast.at, blast.direction);
    }

    fx.punchCamera('strike');
  },

  cross: async ({ fx, colCount, rowCount }, _uid, blast) => {
    await fx.playCrossBlast(blast.at, blast.width, { colCount, rowCount });
    fx.punchCamera('shockwave');
  },

  area: async ({ fx }, _uid, blast) => {
    await fx.playAreaBlast(blast.at, blast.radius);
    fx.punchCamera(blast.radius > 1 ? 'shockwave' : 'strike');
  },

  takeoff: async ({ fx }, _uid, blast) => {
    await fx.playTakeoff(blast.at);
  },

  flight: async ({ fx }, _uid, blast) => {
    await fx.playPropellerFlight(blast.from, blast.to, blast.carried);
    fx.punchCamera('strike');
  },

  color: async ({ fx }, _uid, blast) => {
    await fx.playColorRays(blast.at, blast.targets);
    fx.flashBoard();
    fx.punchCamera('colorSweep');
  },

  board: async ({ fx, colCount, rowCount }, _uid, blast) => {
    fx.flashBoard();
    await fx.playBoardBlast(blast.at, { colCount, rowCount });
    fx.punchCamera('shockwave');
  },
};

export const DEFAULT_STEP_ANIMATIONS: TStepAnimations = {
  /**
   * Пара меняется клетками: доигрывает анимацию переезда и переписывает грид.
   * Остаток пути, а не полный шаг (`scaleToDistance`): палец уже провёл пару
   * почти до места.
   */
  swap: async ({ sound, board }, { first: firstUid, second: secondUid }) => {
    sound?.play('swap');

    const first = board.entity(firstUid);
    const second = board.entity(secondUid);

    if (!first || !second) {
      return;
    }

    const firstCoords = first.getVisualCoords();
    const secondCoords = second.getVisualCoords();

    await Promise.all([
      first.moveToCoords(secondCoords.visualX, secondCoords.visualY, { scaleToDistance: true }),
      second.moveToCoords(firstCoords.visualX, firstCoords.visualY, { scaleToDistance: true }),
    ]);

    const firstCol = first.x;
    const firstRow = first.y;

    board.place(first, second.x, second.y);
    board.place(second, firstCol, firstRow);
  },

  detonate: (context, { uid, blast }) => {
    context.sound?.play(BLAST_SOUND[blast.kind]);

    // Запись реестра берётся по виду этого же взрыва: сужение по `blast.kind`
    // компилятор через индекс не протаскивает.
    const animate = BLAST_ANIMATIONS[blast.kind] as TBlastAnimation<TBoardBlast['kind']>;

    return animate(context, uid, blast);
  },

  /**
   * Радуга+спецфишка: фишки цвета превращаются в спецфишки - старый спрайт
   * гаснет (и засчитывается в цель, как разрушенный), новый выскакивает на его
   * месте. Взрывы превращённых идут следующими шагами.
   */
  transform: async ({ core, sound, board }, { changes }) => {
    sound?.play('specialSpawn');

    for (const { uid, placement } of changes) {
      board.detach(uid)?.takeDamage(0);
      board.spawn(placement.piece, placement.col, placement.row).playSpawnPop();
    }

    await core.motion.delay(BOARD_TIMING.special.transformMs);
  },

  /** Бустер «луч» наносит урон выбранной клетке. */
  beam: async ({ fx, sound, board }, { uid }) => {
    sound?.play('rocket');
    await board.entity(uid)?.beamCellAnimation();
    fx.punchCamera('strike');
  },

  colorSweep: async ({ fx, sound, board }, { uids }) => {
    sound?.play('rainbow');
    await Promise.all(uids.map((uid) => board.entity(uid)?.laserCellAnimation()));

    // Вспышка + тряска в момент, когда порталы «выстрелили» и все фишки цвета
    // уходят разом: главный «wow»-момент бустера.
    fx.flashBoard();
    fx.punchCamera('colorSweep');
  },

  rowsBlast: async ({ fx, sound }, { row, rows }) => {
    sound?.play('bomb');
    // Волна на каждой задетой строке, шар - по своей.
    await fx.playRowsWave(row, rows);

    // Удар волны по трём строкам - самый сильный одиночный эффект в игре:
    // камера отвечает заметнее всех остальных бустеров.
    fx.punchCamera('shockwave');
  },

  /**
   * Пачка ударов без ожидания анимаций: судьбу клетки уже решил движок,
   * `takeDamage()` только показывает её, дестрой играет параллельно. Грид
   * освобождается сразу, и падение может стартовать, не дожидаясь догорания -
   * визуально догорающая фишка сжата раньше, чем в её клетку въедет соседка
   * (барьер `DESTROY_BARRIER_MS` в `settle`). Цели этого батча уже засчитаны.
   */
  damage: (context, { hits }) => {
    for (const hit of hits) {
      if (hit.layer === 'piece') {
        hitPiece(context, hit);
      } else {
        hitLayer(context, hit);
      }
    }
  },

  matches: ({ sound, accents }, { iteration, groups }) => {
    sound?.playMatch(iteration);
    accents.play(iteration, groups);
  },

  special: (context, { placement }) => {
    context.sound?.play('specialSpawn');
    spawnSpecial(context, placement);
  },

  /**
   * Доска оседает после урона: барьер, гравитация, добор новых фишек.
   *
   * Падение и добор идут внахлёст, а не одно за другим: остановки между ними
   * в логике доски нет. Грид пишется синхронно до первого твина, поэтому
   * добор видит клетки уже после падения. Внутри колонки и падения, и добор
   * идут снизу вверх (так их отдаёт движок), и номер в этой очереди - номер
   * волны: колонка обрушивается, а не переезжает плитой.
   */
  settle: async ({ core, board }, { moves, spawns }) => {
    await core.motion.delay(DESTROY_BARRIER_MS);

    const tweens: Promise<unknown>[] = [];
    const fallWave = new Map<number, number>();
    const spawnWave = new Map<number, number>();
    const nextWave = (waves: Map<number, number>, col: number): number => {
      const wave = waves.get(col) ?? 0;

      waves.set(col, wave + 1);

      return wave;
    };

    // Сначала освобождаем все старые клетки, потом занимаем новые: падающая
    // фишка может въехать в клетку, которую в этом же шаге покидает соседка.
    const fallen = moves.map((move) => ({ move, entity: board.entity(move.uid) }));

    for (const { move, entity } of fallen) {
      if (entity) {
        board.vacate(entity, move.from);
      }
    }

    for (const { move, entity } of fallen) {
      const last = move.path[move.path.length - 1];

      if (!entity || !last) {
        continue;
      }

      board.place(entity, last.col, last.row);
      tweens.push(
        entity.fall(move.from, move.path, resolveFallDelayMs(nextWave(fallWave, move.from.col)))
      );
    }

    for (const spawn of spawns) {
      const tile = board.spawn(spawn.piece, spawn.col, spawn.row);
      const entryCol = spawn.path[0]?.col ?? spawn.col;

      // Добор на месте: в клетку ничто не падает, и въезд сверху прошёл бы
      // сквозь блокер над ней. Фишка вырастает в клетке, как на старте партии.
      if (spawn.inPlace) {
        tweens.push(tile.appearAnimation());
        continue;
      }

      tweens.push(tile.enter(spawn.path, resolveFallDelayMs(nextWave(spawnWave, entryCol))));
    }

    await Promise.all(tweens);
  },

  /**
   * «Опусти вниз» на дне колонки собраны: клетка свободна сразу, предмет
   * взлетает к панели целей параллельно со следующим оседанием. Шаг цели
   * озвучивает подписка `SoundEngine` на стор - здесь только сам взлёт.
   */
  collect: ({ sound, board }, { uids }) => {
    for (const uid of uids) {
      const entity = board.detach(uid);

      if (entity instanceof DropEntity) {
        void entity.collect();
      }
    }

    sound?.play('collect');
  },

  /**
   * Пауза перед следующим звеном, убывающая с глубиной: каскад должен
   * набирать, а не идти ровным шагом.
   */
  cascadePause: ({ core }, { iteration }) =>
    core.motion.delay(resolveCascadeIterationDelayMs(iteration)),

  /**
   * Перемешка тупика: фишки разъезжаются по новым клеткам одной анимацией.
   * Раскладку уже выбрал движок (`BoardEngine.resolveDeadEnd`).
   */
  shuffle: async ({ sound, board }, { placements }) => {
    sound?.play('shuffle');

    const moved = placements.flatMap((placement) => {
      const entity = board.entity(placement.uid);

      return entity ? [{ placement, entity }] : [];
    });

    for (const { entity } of moved) {
      board.vacate(entity);
    }

    for (const { placement, entity } of moved) {
      board.place(entity, placement.col, placement.row);
    }

    await Promise.all(
      moved.map(({ entity }) => {
        const coords = entity.getVisualCoords();

        return entity.moveToCoords(coords.visualX, coords.visualY);
      })
    );
  },

  /**
   * Слизь расползлась: поглощённая фишка тихо уходит (в цель не идёт), новая
   * слизь выползает из соседней клетки на её место.
   */
  spread: async ({ sound, board }, { from, eaten, placement }) => {
    sound?.play('spread');
    void board.detach(eaten)?.vanish();

    const slime = board.spawn(placement.piece, placement.col, placement.row);

    if (slime instanceof SlimeEntity) {
      await slime.playSpread(from);
    }
  },

  /**
   * Оставшиеся ходы уходят в бонус: счётчик ходов быстро тикает до нуля, и
   * следом фишки доски становятся ракетами (`transform`).
   */
  bonus: async ({ core, hud, sound, isDestroyed }, { moves }) => {
    sound?.play('bonus');

    const tickMs = Math.min(BONUS_TICK_MAX_MS, BONUS_COUNTDOWN_MS / Math.max(1, moves));

    for (let left = moves; left > 0 && !isDestroyed(); left--) {
      hud.decreaseMoves();
      await core.motion.delay(tickMs);
    }
  },

  /**
   * Предуровневые бустеры встают на доску: фишка уходит без разрушения (не
   * в цель и не в очки), спецфишка выскакивает на её месте со вспышкой.
   */
  preBoost: async (context, { replaced, placements }) => {
    context.sound?.play('specialSpawn');

    for (const uid of replaced) {
      void context.board.detach(uid)?.vanish();
    }

    for (const placement of placements) {
      spawnSpecial(context, placement);
    }

    await context.core.motion.delay(BOARD_TIMING.special.spawnMs);
  },
};
