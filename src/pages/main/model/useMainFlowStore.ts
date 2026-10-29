import { create } from 'zustand';
import {
  listLevelMechanics,
  type IGameStartBooster,
  type IMinigameLevelConfig,
  type TLevelMechanic,
  type TPreLevelBoosterKind,
} from '@/entities/game';
import {
  DEFAULT_LEVEL_BOOSTERS,
  DEFAULT_LEVEL_PACK,
  getNextShowcaseKey,
  getPackLevel,
  getShowcaseLevel,
  levelHasStars,
  type ILevelPack,
} from '@/entities/level';
import {
  applyPartyResult,
  EMPTY_LEVEL_PROGRESS,
  markMechanicSeen,
  readLevelProgress,
  resolveContinueOffer,
  resolveCurrentLevel,
  resolveNextLevelNumber,
  resolvePartyBoosters,
  resolvePreBoosterOptions,
  resolveStartLevelNumber,
  resolveTutorial,
  writeLevelProgress,
  type ILevelProgress,
} from '@/features/match3Host';
import { readQueryLevel } from '@/shared/lib/routing';
import {
  warmGameAssets,
  warmPartyAssets,
  type IGameOutcome,
  type IOutOfMovesOffer,
  type TGameRuntimeFailure,
} from '@/widgets/game';
import { MODAL_KEYS, prefetchModalChunk, useModalsStore } from '@/widgets/modals';
import { MAIN_TEXTS } from '../texts';

/**
 * Пак, который играет главная. Паков в репозитории может быть несколько
 * (`entities/level/packs`), но хост шаблона ведёт один: выбор пака игроком -
 * продуктовое решение конкретной игры. Прогресс пишется под id этого пака.
 */
export const HOST_LEVEL_PACK: ILevelPack = DEFAULT_LEVEL_PACK;

const LEVEL_COUNT = HOST_LEVEL_PACK.levels.length;

/**
 * Что сейчас на главной. `map` - карта уровней со звёздами, `showcase` -
 * витрина механик. `result` - партия доиграна: доски уже нет (рантайм
 * уничтожен сразу по исходу), на экране фон партии и карточка результата.
 */
export type TMainScreen = 'home' | 'map' | 'showcase' | 'game' | 'result';

/**
 * Экран партии: сама доска (`game`) и её фон под карточкой результата
 * (`result`). Главная и карта уровней - фон главной.
 */
export const isPartyScreen = (screen: TMainScreen): boolean =>
  screen === 'game' || screen === 'result';

/**
 * Откуда уровень партии: из пака (номер в каталоге - его исход пишется в
 * прогресс) или из витрины (ключ уровня витрины - вне прогресса).
 */
export type TMainPartySource =
  { kind: 'pack'; levelNumber: number } | { kind: 'showcase'; key: string };

/** Что играет текущая партия: откуда уровень и то, что уходит пропсами виджету. */
export interface IMainParty {
  source: TMainPartySource;
  level: IMinigameLevelConfig;
  /** Подпись под доской; без неё виджет пишет «Уровень N». */
  title?: string;
  boosters: IGameStartBooster[];
  /** Предуровневые бустеры, выбранные на карточке уровня. */
  preBoosters: TPreLevelBoosterKind[];
  /** Механики уровня, которым игрок ещё не учился (подсказки перед ходом). */
  tutorial: TLevelMechanic[];
}

interface IMainFlowStore {
  screen: TMainScreen;
  /** Номер партии: `key` экрана партии, новый на каждый старт. */
  partyId: number;
  /** Номер, конфиг и бустеры партии; есть только на `screen: 'game'`. */
  party: IMainParty | null;
  /** Почему прошлая партия оборвалась: главная показывает причину. */
  failure: TGameRuntimeFailure | null;
  /** Сколько раз в этой партии игрок взял добавочные ходы. */
  continuesUsed: number;
  /**
   * Прогресс игрока (`levelProgress`): открытые уровни, звёзды, рекорды,
   * знакомые механики. Живёт в `localStorage`, стор - его копия в памяти.
   * Текущий уровень («Играть · уровень N», подсветка на карте) - не отдельное
   * поле, а производное от него (`selectCurrentLevel`): копия разъезжалась
   * с прогрессом после переигровки старого уровня с карты.
   */
  progress: ILevelProgress;
  /** Карта уровней со звёздами. */
  openMap: () => void;
  /** С карты - на главную. */
  closeMap: () => void;
  /** Витрина механик: по уровню на блокер, спецфишку и комбинацию. */
  openShowcase: () => void;
  /** С витрины - на главную. */
  closeShowcase: () => void;
  /**
   * Уровень витрины - сразу партия, без карточки уровня: что показывает
   * уровень, написано в списке витрины. Прогресс игрока партия не трогает.
   */
  playShowcase: (key: string) => void;
  /** Игрок прочитал подсказку механики: больше её не показывать. */
  tutorialSeen: (mechanic: TLevelMechanic) => void;
  /** Начать с первого уровня: прогресс и знакомые механики стираются. */
  resetProgress: () => void;
  /** «Играть» с главной: карточка уровня из `?level=N`, иначе текущего. */
  play: () => void;
  /**
   * Карточка уровня перед партией: цели, ходы и предуровневые бустеры;
   * «Играть» на ней поднимает партию.
   */
  openLevelStart: (levelNumber: number) => void;
  /** Исход партии от виджета: карточка результата поверх фона партии. */
  finish: (outcome: IGameOutcome) => void;
  /** Ходы кончились, цели нет: предложить добавочные ходы или сдаться. */
  outOfMoves: (offer: IOutOfMovesOffer) => void;
  /** Выход из партии или с карточки результата. */
  goHome: () => void;
  /** Рантайм отказал: назад на главную с объяснением. */
  fail: (failure: TGameRuntimeFailure) => void;
}

/**
 * Текущий уровень хоста - самый дальний открытый в границах каталога: его
 * начинает «Играть» с главной и его подсвечивает карта. Производное от
 * прогресса, а не поле стора - иначе переигровка старого уровня с карты
 * сдвигала бы «Играть» назад от открытого.
 */
export const selectCurrentLevel = (state: Pick<IMainFlowStore, 'progress'>): number =>
  resolveCurrentLevel(state.progress, LEVEL_COUNT);

const hideResult = (): void => {
  useModalsStore
    .getState()
    .hideMany([
      MODAL_KEYS.VICTORY,
      MODAL_KEYS.DEFEAT,
      MODAL_KEYS.OUT_OF_MOVES,
      MODAL_KEYS.LEVEL_START,
    ]);
};

/**
 * Хост партии на главной: какой уровень играть, что делать с исходом и
 * выходом. Сама партия - виджет `widgets/game`, он про уровни и экраны ничего
 * не знает. Правила выбора уровня и бустеров - чистые функции
 * `features/match3Host` (`partyRules`), прогресс - его же `levelProgress`
 * (`localStorage`).
 *
 * Стор, а не `useState` страницы, потому что «Играть» живёт в отдельном
 * компоненте (`MainActions`), карта - в своём (`LevelMap`), а карточки уровня
 * и результата - в модалках вне дерева страницы.
 */
export const useMainFlowStore = create<IMainFlowStore>()((set, get) => {
  const saveProgress = (progress: ILevelProgress) => {
    writeLevelProgress(HOST_LEVEL_PACK.id, progress);
    set({ progress });
  };

  /**
   * Новая партия - новый `partyId`, то есть новый маунт экрана партии.
   * Стартовать можно только с главной или с карточки результата: из `game` в
   * `game` экран сменил бы `key` под живым рантаймом, а два рантайма
   * одновременно жить не могут (см. `GameScreen`). Двойной тап по кнопке
   * отсекается тем же правилом.
   */
  const startParty = (source: TMainPartySource, preBoosters: TPreLevelBoosterKind[] = []) => {
    if (get().screen === 'game') {
      return;
    }

    hideResult();

    const showcase = source.kind === 'showcase' ? getShowcaseLevel(source.key) : null;
    const level =
      source.kind === 'pack'
        ? getPackLevel(HOST_LEVEL_PACK, source.levelNumber)
        : (showcase?.level ?? null);

    // Каталог проверен тестом, но пустой или битый каталог не должен оставлять
    // игрока перед вечным спиннером.
    if (!level) {
      set({ screen: 'home', party: null, failure: 'board' });
      return;
    }

    // Текстуры доски, арт и чанки результата греются без ожидания: к моменту,
    // когда рантайм их запросит, они уже в кэше.
    void warmGameAssets();
    void warmPartyAssets();
    prefetchModalChunk(MODAL_KEYS.VICTORY);
    prefetchModalChunk(MODAL_KEYS.DEFEAT);
    prefetchModalChunk(MODAL_KEYS.OUT_OF_MOVES);

    set((state) => ({
      screen: 'game',
      partyId: state.partyId + 1,
      party: {
        source,
        level,
        ...(showcase ? { title: MAIN_TEXTS.showcase.partyTitle(showcase.title) } : {}),
        // Витрина показывает механику целиком: бустеры есть всегда, а
        // подсказка механики - и тем, кто её уже видел.
        boosters:
          source.kind === 'pack'
            ? resolvePartyBoosters(source.levelNumber)
            : DEFAULT_LEVEL_BOOSTERS,
        preBoosters,
        tutorial:
          source.kind === 'pack'
            ? resolveTutorial(level, state.progress)
            : listLevelMechanics(level),
      },
      failure: null,
      continuesUsed: 0,
    }));
  };

  const initialProgress = readLevelProgress(HOST_LEVEL_PACK.id);

  return {
    screen: 'home',
    partyId: 0,
    party: null,
    failure: null,
    continuesUsed: 0,
    progress: initialProgress,

    play: () => {
      if (get().screen !== 'home') {
        return;
      }

      get().openLevelStart(
        resolveStartLevelNumber(readQueryLevel(), selectCurrentLevel(get()), LEVEL_COUNT)
      );
    },

    openLevelStart: (levelNumber) => {
      if (get().screen === 'game') {
        return;
      }

      const level = getPackLevel(HOST_LEVEL_PACK, levelNumber);

      if (!level) {
        set({ screen: 'home', party: null, failure: 'board' });
        return;
      }

      // Карточку открывают и с главной, и поверх фона прошлой партии: картинки
      // доски греются уже сейчас, пока игрок выбирает бустеры.
      void warmGameAssets();

      useModalsStore.getState().show(MODAL_KEYS.LEVEL_START, {
        levelNumber,
        name: level.title ?? '',
        moves: level.moves,
        goals: level.levelGoals,
        preBoosterOptions: resolvePreBoosterOptions(levelNumber),
        bestStars: levelHasStars(level) ? get().progress.stars[levelNumber] : undefined,
        onStart: (preBoosters) => startParty({ kind: 'pack', levelNumber }, preBoosters),
        // Передумал играть: с главной карточка просто закрывается, а с фона
        // прошлой партии - назад на главную, доски под ней уже нет.
        onClose: () => {
          if (get().screen === 'result') {
            get().goHome();
          }
        },
      });
    },

    finish: ({ isVictory, score, stars }) => {
      const { screen, party } = get();

      if (screen !== 'game' || !party) {
        return;
      }

      const { source } = party;
      let onPlay: () => void;

      if (source.kind === 'pack') {
        const { levelNumber } = source;
        // Прогресс (звёзды, рекорд, открытый уровень) пишется до показа
        // карточки: «Играть» с главной и карта читают уже его, а карточка
        // показывает уже записанный результат. «Дальше» ведёт на уровень после
        // сыгранного, «Ещё раз» - на тот же.
        const nextLevel = isVictory
          ? resolveNextLevelNumber(levelNumber, LEVEL_COUNT)
          : levelNumber;

        saveProgress(
          applyPartyResult(get().progress, levelNumber, { isVictory, score, stars }, LEVEL_COUNT)
        );
        onPlay = () => get().openLevelStart(nextLevel);
      } else {
        // Витрина прогресс не пишет: «Дальше» - следующая механика, «Ещё раз» -
        // та же, обе сразу партией, как и старт из списка витрины.
        const nextKey = isVictory ? getNextShowcaseKey(source.key) : source.key;

        onPlay = () => get().playShowcase(nextKey);
      }

      set({ screen: 'result', party: null });
      useModalsStore.getState().show(isVictory ? MODAL_KEYS.VICTORY : MODAL_KEYS.DEFEAT, {
        onPlay,
        onHome: () => get().goHome(),
        score,
        stars,
      });
    },

    outOfMoves: (offer) => {
      const extraMoves = resolveContinueOffer(get().continuesUsed);

      if (get().screen !== 'game' || extraMoves === null) {
        offer.giveUp();
        return;
      }

      useModalsStore.getState().show(MODAL_KEYS.OUT_OF_MOVES, {
        goalsLeft: offer.goalsLeft,
        extraMoves,
        onContinue: () => {
          set((state) => ({ continuesUsed: state.continuesUsed + 1 }));
          offer.continueWith(extraMoves);
        },
        onGiveUp: () => offer.giveUp(),
      });
    },

    openMap: () => {
      if (get().screen === 'home') {
        set({ screen: 'map' });
      }
    },

    closeMap: () => {
      if (get().screen === 'map') {
        set({ screen: 'home' });
      }
    },

    openShowcase: () => {
      if (get().screen === 'home') {
        set({ screen: 'showcase' });
      }
    },

    closeShowcase: () => {
      if (get().screen === 'showcase') {
        set({ screen: 'home' });
      }
    },

    playShowcase: (key) => {
      startParty({ kind: 'showcase', key });
    },

    tutorialSeen: (mechanic) => {
      // Витрина показывает подсказки всех механик и прогресс не пишет: иначе
      // игрок, открывший её первым, остался бы без обучения на уровнях пака.
      if (get().party?.source.kind === 'showcase') {
        return;
      }

      saveProgress(markMechanicSeen(get().progress, mechanic));
    },

    resetProgress: () => {
      saveProgress(EMPTY_LEVEL_PROGRESS);
    },

    goHome: () => {
      hideResult();
      set({ screen: 'home', party: null });
    },

    fail: (failure) => {
      hideResult();
      set({ screen: 'home', party: null, failure });
    },
  };
});
