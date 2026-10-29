import type { TMinigameChipId } from '../lib/minigameLevelConfig';
import type {
  IChipPiece,
  ISlimePiece,
  TBoardLayer,
  TLaserDirection,
  TSpecialKind,
  TSpecialPiece,
} from './boardPieces';

/**
 * Шаги хода - то, что движок отдаёт рантайму на проигрывание.
 *
 * Движок разыгрывает ход целиком и синхронно: свап, все звенья каскада,
 * взрывы спецфишек, падения и добор уже случились в его гриде, когда вызов
 * вернулся. Шаги - это протокол этих событий в том порядке, в котором их надо
 * показать, и ровно с теми данными, которые нужны анимации. Рантайм ничего не
 * решает сам: какую клетку бить, куда падать и какого цвета добор - написано в
 * шаге.
 */

export interface IBoardCellPos {
  col: number;
  row: number;
}

/**
 * Удар по слою клетки: по предмету, накладке или подложке. Сколько у слоя
 * осталось и разрушен ли он.
 */
export interface IBoardHit {
  uid: number;
  /**
   * Код слоя (`red`, `cargo`, `ice`, `floor`, ...) - тот же, что у цели
   * уровня. Прогресс целей считается прямо по шагам (`listGoalEvents`) - и
   * в партии, и у бота.
   */
  id: string;
  layer: TBoardLayer;
  /** Прочность после удара. */
  hp: number;
  destroyed: boolean;
}

export interface IBoardChipPlacement extends IBoardCellPos {
  piece: IChipPiece;
}

export interface IBoardSpecialPlacement extends IBoardCellPos {
  piece: TSpecialPiece;
}

/**
 * Путь фишки при оседании: клетки по одной за такт гравитации (дыры она
 * пролетает целиком). Путь бывает и диагональным - фишка соскальзывает под
 * неподвижный блокер.
 */
export interface IBoardMove {
  uid: number;
  from: IBoardCellPos;
  path: IBoardCellPos[];
}

/** Новая фишка: где встала и как туда ехала - от верха своей колонки. */
export interface IBoardSpawn extends IBoardChipPlacement {
  path: IBoardCellPos[];
  /**
   * Появилась прямо в клетке: туда ничто не падает - под серединой ряда
   * неподвижных клеток или в замкнутом кармане. Путь - одна эта клетка.
   */
  inPlace?: true;
}

export interface IBoardPlacement extends IBoardCellPos {
  uid: number;
}

export interface IBoardSlimePlacement extends IBoardCellPos {
  piece: ISlimePiece;
}

/** Фишка превратилась в спецфишку (радуга в паре со спецфишкой). */
export interface IBoardTransform {
  /** Паспорт фишки, которой больше нет. */
  uid: number;
  /** Цвет этой фишки: превращённая засчитывается в цель, как разрушенная. */
  id: string;
  placement: IBoardSpecialPlacement;
}

/**
 * Что сработало и где. Это данные для анимации: урон по клеткам идёт следом
 * отдельным шагом `damage`, и детонации задетых спецфишек - своими шагами.
 */
export type TBoardBlast =
  /** Ракета: строка или колонка через клетку. */
  | { kind: 'line'; at: IBoardCellPos; direction: TLaserDirection }
  /**
   * Строки и колонки через клетку: ракета+ракета (`width: 1`) и ракета+бомба
   * (`width: 3` - по три строки и колонки).
   */
  | { kind: 'cross'; at: IBoardCellPos; width: 1 | 3 }
  /** Бомба (`radius: 1` - 3×3) и бомба+бомба (`radius: 2` - 5×5). */
  | { kind: 'area'; at: IBoardCellPos; radius: number }
  /** Пропеллер взлетает: его клетка и четыре соседа. */
  | { kind: 'takeoff'; at: IBoardCellPos }
  /** Пропеллер долетел до цели; `carried` - спецфишка, которую он несёт. */
  | { kind: 'flight'; from: IBoardCellPos; to: IBoardCellPos; carried: TSpecialKind | null }
  /** Радуга: все фишки цвета. */
  | { kind: 'color'; at: IBoardCellPos; color: TMinigameChipId; targets: IBoardCellPos[] }
  /** Радуга+радуга: всё поле. */
  | { kind: 'board'; at: IBoardCellPos };

export type TBoardStep =
  /** Пара поменялась клетками (валидный свап, свап со спецфишкой). */
  | { type: 'swap'; first: number; second: number }
  /**
   * Сработала спецфишка или комбинация. `uid` - спрайт, который играет
   * анимацию; к моменту шага он ещё на доске (у полёта пропеллера - уже нет).
   */
  | { type: 'detonate'; uid: number; blast: TBoardBlast }
  /** Фишки превратились в спецфишки (радуга+спецфишка) - и сработают следом. */
  | { type: 'transform'; changes: IBoardTransform[] }
  /** Бустер «луч» по одной клетке. */
  | { type: 'beam'; uid: number }
  /** Бустер «лазер»: все фишки одного цвета. */
  | { type: 'colorSweep'; uids: number[] }
  /**
   * Бустер «шар»: волна по каждой строке из `rows` (три вокруг строки шара,
   * у края поля - две), сам шар летит по строке `row`.
   */
  | { type: 'rowsBlast'; row: number; rows: number[] }
  /** Пачка ударов, нанесённых одним событием. */
  | { type: 'damage'; hits: IBoardHit[] }
  /** Звено каскада: какие фигуры собрались (для попапа «×N» и акцентов). */
  | { type: 'matches'; iteration: number; groups: IBoardCellPos[][] }
  /** Родилась спецфишка за фигуру. */
  | { type: 'special'; placement: IBoardSpecialPlacement }
  /**
   * Доска осела: пути падений и добор новых фишек сверху. Порядок в обоих
   * списках - в каком фишки трогались: внутри колонки нижняя раньше верхней.
   */
  | { type: 'settle'; moves: IBoardMove[]; spawns: IBoardSpawn[] }
  /** «Опусти вниз» дошли до дна колонки и собраны. */
  | { type: 'collect'; uids: number[] }
  /** Пауза перед следующим звеном каскада. */
  | { type: 'cascadePause'; iteration: number }
  /** Перемешка тупика: новые клетки всех фишек. */
  | { type: 'shuffle'; placements: IBoardPlacement[] }
  /**
   * Слизь расползлась из клетки `from` на соседнюю фишку: фишка `eaten`
   * поглощена (в цель не идёт), на её месте - новая слизь.
   */
  | { type: 'spread'; from: IBoardCellPos; eaten: number; placement: IBoardSlimePlacement }
  /**
   * Финальный бонус победы: `moves` оставшихся ходов уходят в ракеты. Следом
   * идут превращение фишек (`transform`) и взрывы.
   */
  | { type: 'bonus'; moves: number }
  /**
   * Предуровневые бустеры встали на стартовую доску: фишки `replaced` уступили
   * клетки спецфишкам. Это не разрушение - ни цели, ни очков.
   */
  | { type: 'preBoost'; replaced: number[]; placements: IBoardSpecialPlacement[] };

/** Результат свапа от игрока. */
export type TBoardSwapOutcome =
  /** Ход невозможен в принципе: блокер, дыра, край доски, не соседи. */
  | { kind: 'blocked' }
  /** Пара может поменяться, но фигуры не даёт - ход отклонён, доска прежняя. */
  | { kind: 'rejected' }
  | { kind: 'accepted'; steps: TBoardStep[] };

/** Разбор доски после хода: что делать, если ходов не осталось. */
export type TBoardDeadEndOutcome =
  | { kind: 'hasMove' }
  /** Ходов фишками нет, но на доске лежит спецфишка - подсветить её как выход. */
  | { kind: 'specialHint'; uid: number }
  /** Доска перемешана (и, возможно, тут же сыграла каскадом). */
  | { kind: 'shuffled'; steps: TBoardStep[] }
  /** Хода не построить никакой перестановкой - партия проиграна. */
  | { kind: 'stuck' };
