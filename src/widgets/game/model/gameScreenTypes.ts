import type {
  IGameStartBooster,
  IMinigameLevelConfig,
  TLevelMechanic,
  TLevelStars,
  TPreLevelBoosterKind,
} from '@/entities/game';
import type { TRenderQualityMode } from '../configs/renderQuality';
import type { TRendererMode } from '../configs/renderer';
import type { TBoardEvent } from './boardEvents';
import type { ISceneInsets } from '../configs/sceneInsets';
import type { TGameRuntimeFailure } from '../store/GameStore';

export interface IGameOutcome {
  isVictory: boolean;
  /** Очки партии с финальным бонусом (`entities/game` `boardScore`). */
  score: number;
  /**
   * Звёзды: 0 - поражение, 1 - победа, 2-3 - победа с очками сверх порогов
   * уровня (`starScores`, `resolveLevelStars`); `null` - у уровня звёзд нет.
   */
  stars: TLevelStars | null;
}

/** Сколько ещё нужно по цели уровня. */
export interface IGameGoalLeft {
  id: string;
  left: number;
}

/**
 * Предложение хосту, когда ходы кончились, а цели - нет (near-miss). Хост
 * решает ровно одно: продолжить партию с добавочными ходами или сдаться.
 * Пока решения нет, доска стоит: ход, тап и бустер не принимаются.
 */
export interface IOutOfMovesOffer {
  /** Незакрытые цели - то, что хост показывает на карточке «ещё чуть-чуть». */
  goalsLeft: IGameGoalLeft[];
  /** Продолжить партию с `moves` добавочными ходами. */
  continueWith: (moves: number) => void;
  /** Отказаться: партия кончается поражением (финальная сцена и `onFinish`). */
  giveUp: () => void;
}

export interface IGameScreenCallbacks {
  /** Партия доиграна: рантайм закончил финальную сцену на доске. */
  onFinish: (outcome: IGameOutcome) => void;
  /**
   * Ходы кончились, цели не закрыты. Без колбэка партия сразу кончается
   * поражением; с ним рантайм ждёт решения хоста (`IOutOfMovesOffer`).
   * Наличие колбэка читается на старте партии.
   */
  onOutOfMoves?: (offer: IOutOfMovesOffer) => void;
  /**
   * Игрок прочитал подсказку механики (`tutorial`) и нажал «Понятно». Хост
   * запоминает механику как знакомую и в следующих партиях её не передаёт.
   */
  onTutorialSeen?: (mechanic: TLevelMechanic) => void;
  /** Игрок нажал «выход» в канвасе. Подтверждать или нет, решает хост. */
  onExitRequest: () => void;
  /** Рантайм отказал, продолжать партию нечем (см. `TGameRuntimeFailure`). */
  onError: (failure: TGameRuntimeFailure) => void;
  /**
   * События партии по ходу игры: ход, звено каскада, рождение спецфишки, шаг
   * и закрытие цели, бустер, очки (`TBoardEvent`). Для аналитики, вибрации,
   * своих звуков - на ход партии они не влияют. Выводятся из протокола хода и
   * стора, а не из анимаций: переопределённая анимация шага их не теряет.
   */
  onBoardEvent?: (event: TBoardEvent) => void;
}

/**
 * Внешний API экрана партии. Одна партия - один маунт: новая партия (повтор,
 * следующий уровень) - это новый `key` у компонента, а не смена `level`.
 */
export interface IGameScreenProps extends IGameScreenCallbacks {
  level: IMinigameLevelConfig;
  /** Бустеры на старте партии. Пустой список прячет панель бустеров. */
  boosters: IGameStartBooster[];
  /**
   * Предуровневые бустеры: спецфишки, которые встанут на стартовую доску
   * сразу после её сборки (ракета, бомба, радуга). Выбирает их хост до партии.
   */
  preBoosters?: readonly TPreLevelBoosterKind[];
  /**
   * Механики, которым надо научить в этой партии (обучение при первой
   * встрече): перед первым ходом виджет показывает по подсказке на каждую,
   * доска на это время стоит. Какие механики игрок уже видел, знает хост
   * (`listLevelMechanics` от уровня минус знакомые), тексты - виджет.
   */
  tutorial?: readonly TLevelMechanic[];
  /**
   * Заморозить рантайм: сцена на паузе, ввод выключен. Нужен, пока поверх
   * доски висит что-то из хоста (например, уходящая карточка результата).
   */
  paused?: boolean;
  /** Отладочные кнопки исхода и хайп-фразы поверх доски. */
  debug?: boolean;
  /**
   * Отступы сцены от верхнего и нижнего края, CSS px: вырез, статус-бар,
   * home-индикатор - всё, что хост знает про свой экран. Фон канваса доходит до
   * края, а шапка, доска и бустеры внутрь отступов не заходят.
   *
   * Тот же контракт есть в CSS: хост может задать `--match3-inset-top` /
   * `--match3-inset-bottom` на любом предке. Проп важнее переменных, а без обоих
   * берётся `env(safe-area-inset-*)` - на обычной странице это ноль.
   */
  insets?: Partial<ISceneInsets>;
  /**
   * Качество отрисовки. `auto` (по умолчанию) - перф-гейт сам понижает
   * разрешение и украшения на устойчивой просадке FPS; `high`/`low` - качество
   * зафиксировано (QA-флаг `?perf=` у хоста).
   */
  quality?: TRenderQualityMode;
  /**
   * Какой рендерер просить: `auto` (по умолчанию) - WebGPU с откатом на WebGL,
   * `webgl`/`webgpu` - предпочтение (QA-флаг `?renderer=` у хоста). Без
   * WebGPU в браузере `webgpu` всё равно даёт WebGL, а не отказ.
   */
  renderer?: TRendererMode;
  /**
   * Зерно случайности партии: добор и перемешка доски. Без него каждая партия
   * берёт случайное; с ним партия с теми же ходами повторяется до клетки
   * (QA-флаг `?seed=N` у хоста).
   */
  seed?: number;
  /**
   * Подпись партии под доской. Без неё - «Уровень N» по `level.id`; хост,
   * у которого уровень не из нумерованного пака (витрина механик), задаёт
   * свою.
   */
  title?: string;
}
