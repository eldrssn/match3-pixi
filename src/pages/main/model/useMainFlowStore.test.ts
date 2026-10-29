import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listLevelMechanics } from '@/entities/game';
import { DEFAULT_LEVEL_BOOSTERS, getPackLevel, SHOWCASE_LEVELS } from '@/entities/level';
import { MODAL_KEYS, useModalsStore } from '@/widgets/modals';
import type * as WidgetsModals from '@/widgets/modals';
import {
  EMPTY_LEVEL_PROGRESS,
  levelProgressStorageKey,
  readLevelProgress as readPackProgress,
} from '@/features/match3Host';
import { HOST_LEVEL_PACK, selectCurrentLevel, useMainFlowStore } from './useMainFlowStore';

const LEVEL_COUNT = HOST_LEVEL_PACK.levels.length;
const getLevelConfig = (levelNumber: number) => getPackLevel(HOST_LEVEL_PACK, levelNumber);
const readLevelProgress = () => readPackProgress(HOST_LEVEL_PACK.id);

// Прогрев ассетов и чанков - побочные эффекты старта, правилам хоста они не
// нужны: в jsdom они только тянули бы картинки и модули модалок.
vi.mock('@/widgets/game', () => ({
  warmGameAssets: vi.fn(() => Promise.resolve()),
  warmPartyAssets: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/widgets/modals', async (importOriginal) => ({
  ...(await importOriginal<typeof WidgetsModals>()),
  prefetchModalChunk: vi.fn(),
}));

const INITIAL_STATE = useMainFlowStore.getState();

const WIN = { isVictory: true, score: 4200, stars: 2 } as const;
const LOSS = { isVictory: false, score: 900, stars: 0 } as const;

const resultProps = () =>
  useModalsStore.getState().modals[MODAL_KEYS.VICTORY]?.props ??
  useModalsStore.getState().modals[MODAL_KEYS.DEFEAT]?.props;

const levelStartProps = () => useModalsStore.getState().modals[MODAL_KEYS.LEVEL_START]?.props;

/** Открытый уровень прогресса - то, что стор читает как текущий. */
const unlockLevel = (unlocked: number) => {
  useMainFlowStore.setState({ progress: { ...EMPTY_LEVEL_PROGRESS, unlocked } });
};

/** «Играть» с главной и «Играть» на карточке уровня. */
const playLevel = () => {
  useMainFlowStore.getState().play();
  levelStartProps()?.onStart([]);
};

beforeEach(() => {
  window.localStorage.clear();
  useMainFlowStore.setState(INITIAL_STATE, true);
  useModalsStore.setState({ modals: {}, openKeys: [] });
  window.history.replaceState(null, '', '/');
});

describe('useMainFlowStore', () => {
  it('«Играть» открывает карточку уровня, а её «Играть» - партию', () => {
    useMainFlowStore.getState().play();

    expect(useMainFlowStore.getState().screen).toBe('home');
    expect(levelStartProps()).toMatchObject({
      levelNumber: 1,
      moves: getLevelConfig(1)?.moves,
      goals: getLevelConfig(1)?.levelGoals,
      // Первый уровень - без предуровневых бустеров.
      preBoosterOptions: [],
    });

    levelStartProps()?.onStart([]);

    const state = useMainFlowStore.getState();
    expect(state.screen).toBe('game');
    expect(state.partyId).toBe(1);
    expect(state.party?.level).toBe(getLevelConfig(1));
    // Первый уровень - без бустеров.
    expect(state.party?.boosters).toEqual([]);
  });

  it('предуровневые бустеры с карточки уходят в партию', () => {
    unlockLevel(Math.min(2, LEVEL_COUNT));
    useMainFlowStore.getState().play();

    expect(levelStartProps()?.preBoosterOptions.length).toBeGreaterThan(0);

    levelStartProps()?.onStart(['bomb', 'rainbow']);

    expect(useMainFlowStore.getState().party?.preBoosters).toEqual(['bomb', 'rainbow']);
  });

  it('закрытая без старта карточка оставляет главную', () => {
    useMainFlowStore.getState().play();
    levelStartProps()?.onClose();

    expect(useMainFlowStore.getState()).toMatchObject({ screen: 'home', party: null });
  });

  it('берёт уровень из ?level в границах каталога', () => {
    window.history.replaceState(null, '', `/?level=${LEVEL_COUNT}`);

    playLevel();

    expect(useMainFlowStore.getState().party?.source).toEqual({
      kind: 'pack',
      levelNumber: LEVEL_COUNT,
    });
  });

  it('игнорирует ?level за пределами каталога', () => {
    window.history.replaceState(null, '', `/?level=${LEVEL_COUNT + 1}`);

    playLevel();

    expect(useMainFlowStore.getState().party?.source).toEqual({ kind: 'pack', levelNumber: 1 });
  });

  it('не стартует вторую партию поверх живой', () => {
    playLevel();
    playLevel();

    expect(useMainFlowStore.getState().partyId).toBe(1);
  });

  it('победа открывает следующий уровень до показа карточки', () => {
    playLevel();
    useMainFlowStore.getState().finish(WIN);

    const state = useMainFlowStore.getState();
    expect(state.screen).toBe('result');
    expect(state.party).toBeNull();
    expect(selectCurrentLevel(state)).toBe(Math.min(2, LEVEL_COUNT));
    expect(useModalsStore.getState().openKeys).toEqual([MODAL_KEYS.VICTORY]);
    // Карточка получает очки и звёзды из исхода виджета.
    expect(resultProps()).toMatchObject({ score: WIN.score, stars: WIN.stars });
  });

  it('поражение оставляет уровень, «Ещё раз» поднимает тот же уровень', () => {
    playLevel();
    useMainFlowStore.getState().finish(LOSS);

    expect(useModalsStore.getState().openKeys).toEqual([MODAL_KEYS.DEFEAT]);

    // «Ещё раз» - через карточку уровня, как и с главной.
    resultProps()?.onPlay();
    expect(levelStartProps()?.levelNumber).toBe(1);
    levelStartProps()?.onStart([]);

    const state = useMainFlowStore.getState();
    expect(state.screen).toBe('game');
    expect(state.party?.source).toEqual({ kind: 'pack', levelNumber: 1 });
    expect(state.partyId).toBe(2);
    expect(useModalsStore.getState().openKeys).toEqual([]);
  });

  it('после последнего уровня победа повторяет последний', () => {
    unlockLevel(LEVEL_COUNT);

    playLevel();
    useMainFlowStore.getState().finish(WIN);

    expect(selectCurrentLevel(useMainFlowStore.getState())).toBe(LEVEL_COUNT);

    resultProps()?.onPlay();
    expect(levelStartProps()?.levelNumber).toBe(LEVEL_COUNT);
  });

  it('переигровка старого уровня с карты не сдвигает текущий уровень назад', () => {
    const unlocked = Math.min(3, LEVEL_COUNT);

    unlockLevel(unlocked);
    useMainFlowStore.getState().openMap();
    useMainFlowStore.getState().openLevelStart(1);
    levelStartProps()?.onStart([]);
    useMainFlowStore.getState().finish(WIN);

    expect(selectCurrentLevel(useMainFlowStore.getState())).toBe(unlocked);

    // «Дальше» всё равно ведёт на уровень после сыгранного.
    resultProps()?.onPlay();
    expect(levelStartProps()?.levelNumber).toBe(Math.min(2, LEVEL_COUNT));
  });

  it('исход вне партии игнорируется', () => {
    useMainFlowStore.getState().finish(WIN);

    expect(useMainFlowStore.getState().screen).toBe('home');
    expect(useModalsStore.getState().openKeys).toEqual([]);
  });

  it('отказ рантайма возвращает на главную с причиной, новая партия её снимает', () => {
    playLevel();
    useMainFlowStore.getState().fail('assets');

    expect(useMainFlowStore.getState()).toMatchObject({
      screen: 'home',
      party: null,
      failure: 'assets',
    });

    playLevel();

    expect(useMainFlowStore.getState().failure).toBeNull();
  });

  it('«На главную» с карточки закрывает её', () => {
    playLevel();
    useMainFlowStore.getState().finish(WIN);

    resultProps()?.onHome();

    expect(useMainFlowStore.getState().screen).toBe('home');
    expect(useModalsStore.getState().openKeys).toEqual([]);
  });

  it('закрытая карточка уровня поверх прошлой партии ведёт на главную', () => {
    playLevel();
    useMainFlowStore.getState().finish(WIN);
    resultProps()?.onPlay();

    levelStartProps()?.onClose();

    expect(useMainFlowStore.getState().screen).toBe('home');
  });

  it('на исходе ходов предлагает «+5» один раз за партию, потом сдаётся сам', () => {
    const offer = { goalsLeft: [{ id: 'red', left: 3 }], continueWith: vi.fn(), giveUp: vi.fn() };

    playLevel();
    useMainFlowStore.getState().outOfMoves(offer);

    const props = useModalsStore.getState().modals[MODAL_KEYS.OUT_OF_MOVES]?.props;

    expect(props).toMatchObject({ goalsLeft: offer.goalsLeft, extraMoves: 5 });

    props?.onContinue();
    expect(offer.continueWith).toHaveBeenCalledWith(5);

    useMainFlowStore.getState().outOfMoves(offer);
    expect(offer.giveUp).toHaveBeenCalledTimes(1);
  });

  it('победа сохраняет прогресс: открытый уровень, звёзды и рекорд', () => {
    playLevel();
    useMainFlowStore.getState().finish(WIN);

    expect(readLevelProgress()).toMatchObject({
      unlocked: Math.min(2, LEVEL_COUNT),
      stars: { 1: WIN.stars },
      bestScores: { 1: WIN.score },
    });
    expect(window.localStorage.getItem(levelProgressStorageKey(HOST_LEVEL_PACK.id))).not.toBeNull();
  });

  it('карточка уровня показывает лучшие звёзды, карта открывается с главной', () => {
    useMainFlowStore.getState().openMap();
    expect(useMainFlowStore.getState().screen).toBe('map');

    playLevel();
    // С карты «Играть» на главной не работает - партию начинает карточка уровня.
    expect(useMainFlowStore.getState().screen).toBe('map');

    useMainFlowStore.getState().openLevelStart(1);
    levelStartProps()?.onStart([]);
    useMainFlowStore.getState().finish(WIN);
    useMainFlowStore.getState().goHome();
    useMainFlowStore.getState().openLevelStart(1);

    expect(levelStartProps()?.bestStars).toBe(WIN.stars);
  });

  it('обучение: в партию уходят только незнакомые механики уровня', () => {
    const levelWithMechanics = Array.from({ length: LEVEL_COUNT }, (_, index) => index + 1).find(
      (level) => listLevelMechanics(getLevelConfig(level) ?? { grid: [] }).length > 0
    );

    if (!levelWithMechanics) {
      return;
    }

    const mechanics = listLevelMechanics(getLevelConfig(levelWithMechanics) ?? { grid: [] });

    useMainFlowStore.getState().tutorialSeen(mechanics[0]);
    useMainFlowStore.getState().openLevelStart(levelWithMechanics);
    levelStartProps()?.onStart([]);

    expect(useMainFlowStore.getState().party?.tutorial).toEqual(mechanics.slice(1));
    expect(readLevelProgress().seenMechanics).toEqual([mechanics[0]]);
  });

  it('сброс прогресса возвращает к первому уровню', () => {
    playLevel();
    useMainFlowStore.getState().finish(WIN);
    useMainFlowStore.getState().goHome();
    useMainFlowStore.getState().resetProgress();

    expect(selectCurrentLevel(useMainFlowStore.getState())).toBe(1);
    expect(readLevelProgress().unlocked).toBe(1);
  });

  it('витрина: уровень сразу партией, с бустерами и всеми подсказками механик', () => {
    const entry = SHOWCASE_LEVELS[0];

    useMainFlowStore.getState().openShowcase();
    expect(useMainFlowStore.getState().screen).toBe('showcase');

    useMainFlowStore.getState().playShowcase(entry.key);

    const { party, screen } = useMainFlowStore.getState();
    expect(screen).toBe('game');
    expect(useModalsStore.getState().openKeys).toEqual([]);
    expect(party).toMatchObject({
      source: { kind: 'showcase', key: entry.key },
      level: entry.level,
      title: `Витрина · ${entry.title}`,
      boosters: DEFAULT_LEVEL_BOOSTERS,
      tutorial: listLevelMechanics(entry.level),
    });
  });

  it('подсказка механики в витрине не отмечает механику знакомой', () => {
    const entry = SHOWCASE_LEVELS[0];

    useMainFlowStore.getState().playShowcase(entry.key);
    useMainFlowStore.getState().tutorialSeen(listLevelMechanics(entry.level)[0]);

    expect(readLevelProgress()).toEqual(EMPTY_LEVEL_PROGRESS);
  });

  it('витрина не пишет прогресс, «Дальше» ведёт на следующую механику', () => {
    const [first, second] = SHOWCASE_LEVELS;

    useMainFlowStore.getState().openShowcase();
    useMainFlowStore.getState().playShowcase(first.key);
    useMainFlowStore.getState().finish(WIN);

    expect(useModalsStore.getState().openKeys).toEqual([MODAL_KEYS.VICTORY]);
    expect(selectCurrentLevel(useMainFlowStore.getState())).toBe(1);
    expect(readLevelProgress()).toEqual(EMPTY_LEVEL_PROGRESS);

    resultProps()?.onPlay();

    expect(useMainFlowStore.getState().party?.source).toEqual({
      kind: 'showcase',
      key: second.key,
    });
  });

  it('витрина: «Ещё раз» после поражения - та же механика', () => {
    const entry = SHOWCASE_LEVELS[0];

    useMainFlowStore.getState().playShowcase(entry.key);
    useMainFlowStore.getState().finish(LOSS);
    resultProps()?.onPlay();

    expect(useMainFlowStore.getState().party?.source).toEqual({
      kind: 'showcase',
      key: entry.key,
    });
    expect(useMainFlowStore.getState().partyId).toBe(2);
  });
});
