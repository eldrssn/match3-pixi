import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TLevelStars, TPreLevelBoosterKind } from '@/entities/game';
import type { TModalKey } from './modal-registry';

/**
 * Действия карточки результата партии. Что делают её кнопки, решает хост
 * партии (`pages/main`): модалка про уровни и экраны ничего не знает.
 */
export interface IGameResultModalProps {
  /** Главная кнопка: «Дальше» на победе, «Ещё раз» на поражении. */
  onPlay: () => void;
  /** «На главную» - и закрытие карточки (Escape) ведёт туда же. */
  onHome: () => void;
  /** Очки партии - из исхода виджета (`IGameOutcome.score`). */
  score: number;
  /**
   * Звёзды партии (`IGameOutcome.stars`): победа рисует их на карточке;
   * `null` - у уровня звёзд нет, карточка показывает только очки.
   */
  stars: TLevelStars | null;
}

/**
 * Карточка near-miss: ходы кончились, цели нет. Что делают кнопки, решает
 * хост партии - он же знает, сколько ходов даёт и сколько раз за партию.
 */
export interface IOutOfMovesModalProps {
  /** Незакрытые цели: код цели (`red`, `cargo`, ...) и сколько осталось. */
  goalsLeft: readonly { id: string; left: number }[];
  /** Сколько ходов добавит «Продолжить». */
  extraMoves: number;
  onContinue: () => void;
  /** «Сдаться» - и закрытие карточки (Escape) ведёт туда же. */
  onGiveUp: () => void;
}

/**
 * Карточка уровня перед партией. Что можно взять с собой и что будет на
 * «Играть», решает хост; выбор бустеров живёт в самой карточке до старта.
 */
export interface ILevelStartModalProps {
  levelNumber: number;
  /** Название уровня из пака; пустое - карточка показывает только номер. */
  name?: string;
  moves: number;
  goals: readonly { id: string; count: number }[];
  /** Какие предуровневые бустеры можно взять; пустой список прячет выбор. */
  preBoosterOptions: readonly TPreLevelBoosterKind[];
  /** Лучший результат уровня в звёздах, если хост его помнит. */
  bestStars?: TLevelStars;
  /** «Играть» с выбранными бустерами. */
  onStart: (preBoosters: TPreLevelBoosterKind[]) => void;
  /** Закрытие без старта (крестик, Escape). */
  onClose: () => void;
}

export interface TModalPropsMap {
  victory: IGameResultModalProps;
  defeat: IGameResultModalProps;
  outOfMoves: IOutOfMovesModalProps;
  levelStart: ILevelStartModalProps;
}

interface IModalEntry<K extends TModalKey = TModalKey> {
  isOpen: boolean;
  props: TModalPropsMap[K] | null;
}

type TModalsRecord = Partial<{ [K in TModalKey]: IModalEntry<K> }>;

export interface IModalsStore {
  modals: TModalsRecord;
  openKeys: TModalKey[];
  /**
   * Пропсы опциональны у всех ключей: вызов без них должен компилироваться.
   */
  show: <K extends TModalKey>(
    key: K,
    ...args: undefined extends TModalPropsMap[K]
      ? [props?: TModalPropsMap[K]]
      : [props: TModalPropsMap[K]]
  ) => void;
  hide: (key: TModalKey) => void;
  hideMany: (keys: readonly TModalKey[]) => void;
  /**
   * Fully forgets a modal entry (props included). Called once the modal has
   * actually left the DOM (see useMountedModalKeys' onUnmounted), so a
   * closing modal keeps its content visible for the whole exit animation
   * instead of flashing back to default props mid-transition.
   */
  purge: (key: TModalKey) => void;
}

const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => Object.is(aRecord[key], bRecord[key]));
};

export const useModalsStore = create<IModalsStore>()(
  subscribeWithSelector((set) => ({
    modals: {},
    openKeys: [],

    show: (key, ...args) =>
      set((state) => {
        const existing = state.modals[key];
        const normalizedProps: IModalEntry['props'] = args[0] ?? null;

        if (existing?.isOpen && shallowEqual(existing.props, normalizedProps)) {
          return state;
        }

        const nextModals: TModalsRecord = {
          ...state.modals,
          [key]: { isOpen: true, props: normalizedProps },
        };
        const nextOpenKeys = existing?.isOpen ? state.openKeys : [...state.openKeys, key];

        return { modals: nextModals, openKeys: nextOpenKeys };
      }),

    hide: (key) =>
      set((state) => {
        const existing = state.modals[key];
        if (!existing?.isOpen) {
          return state;
        }

        return {
          modals: { ...state.modals, [key]: { ...existing, isOpen: false } },
          openKeys: state.openKeys.filter((item) => item !== key),
        };
      }),

    // Одним `set` вместо цепочки `hide()`: закрытие нескольких модалок сразу
    // (уход с маршрута) не должно давать промежуточный кадр, в котором нижняя
    // модалка уже видна.
    hideMany: (keys) =>
      set((state) => {
        const closingKeys = keys.filter((key) => state.modals[key]?.isOpen === true);
        if (closingKeys.length === 0) {
          return state;
        }

        const nextModals = { ...state.modals } as Record<TModalKey, IModalEntry>;
        for (const key of closingKeys) {
          nextModals[key] = { ...nextModals[key], isOpen: false };
        }

        return {
          modals: nextModals as TModalsRecord,
          openKeys: state.openKeys.filter((item) => !closingKeys.includes(item)),
        };
      }),

    purge: (key) =>
      set((state) => {
        if (!(key in state.modals)) {
          return state;
        }

        const { [key]: _removed, ...nextModals } = state.modals;

        return { modals: nextModals };
      }),
  }))
);

const isOpen = (state: IModalsStore, key: TModalKey): boolean => state.modals[key]?.isOpen === true;

/**
 * Запись живёт в сторе до `purge`, то есть всё время, пока модалка есть в DOM,
 * - включая хвост exit-анимации после `hide`. Это единственный способ снаружи
 * отличить «уже закрывается» от «её больше нет», не зная про таймеры хоста.
 */
const isMounted = (state: IModalsStore, key: TModalKey): boolean => key in state.modals;

/**
 * Есть ли в DOM хоть одна модалка - включая ту, что уже закрывается и доигрывает
 * exit-анимацию (запись живёт до `purge`). Главная по этому признаку держит
 * новую партию на паузе, пока над ней уходит карточка результата.
 */
const hasAnyMounted = (state: IModalsStore): boolean => Object.keys(state.modals).length > 0;

const propsOf = <K extends TModalKey>(state: IModalsStore, key: K): TModalPropsMap[K] | null =>
  state.modals[key]?.props ?? null;

/**
 * Селекторы параметризуются ключом, а не пишутся руками на каждую модалку:
 * новая модалка не требует ни своих экшенов, ни своих селекторов.
 */
export const modalsSelectors = {
  modals: (state: IModalsStore) => state.modals,
  openModalKeys: (state: IModalsStore): TModalKey[] => state.openKeys,
  isShowed: (key: TModalKey) => (state: IModalsStore) => isOpen(state, key),
  isMounted: (key: TModalKey) => (state: IModalsStore) => isMounted(state, key),
  props:
    <K extends TModalKey>(key: K) =>
    (state: IModalsStore) =>
      propsOf(state, key),
  hasAnyMounted,
  show: (state: IModalsStore) => state.show,
  hide: (state: IModalsStore) => state.hide,
  hideMany: (state: IModalsStore) => state.hideMany,
  purge: (state: IModalsStore) => state.purge,
};

export const useIsModalShowed = (key: TModalKey): boolean =>
  useModalsStore(modalsSelectors.isShowed(key));

/**
 * `true`, пока модалка присутствует в DOM: и открытой, и на exit-анимации.
 * Нужно сценариям, которые должны дождаться, когда модалка уйдёт полностью.
 */
export const useIsModalMounted = (key: TModalKey): boolean =>
  useModalsStore(modalsSelectors.isMounted(key));

/** `true`, пока в DOM есть хоть одна модалка (включая exit-анимацию). */
export const useHasMountedModals = (): boolean => useModalsStore(modalsSelectors.hasAnyMounted);

export const useModalProps = <K extends TModalKey>(key: K): TModalPropsMap[K] | null =>
  useModalsStore(modalsSelectors.props(key));

export const useShowModal = (): IModalsStore['show'] => useModalsStore(modalsSelectors.show);

export const useHideModal = (): IModalsStore['hide'] => useModalsStore(modalsSelectors.hide);

export const useHideModals = (): IModalsStore['hideMany'] =>
  useModalsStore(modalsSelectors.hideMany);
