import { create } from 'zustand';
import type {
  IGameStartBooster,
  IMinigameLevelConfig,
  TPreLevelBoosterKind,
} from '@/entities/game';
import type { TRenderQualityMode } from '../configs/renderQuality';
import type { TRendererMode } from '../configs/renderer';

/**
 * Уровень партии - ровно формат каталога и редактора: своя копия интерфейса
 * отставала бы от новых полей уровня, и рантайм молча терял бы то, что
 * редактор уже умеет сохранять.
 */
export type LevelConfig = IMinigameLevelConfig;

/**
 * Настройки партии от хоста сверх уровня и бустеров: читаются рантаймом на
 * старте и внутри партии не меняются.
 */
export interface IRuntimePartyOptions {
  /** Хост слушает `onOutOfMoves`: на исходе ходов партия ждёт его решения. */
  offersContinue: boolean;
  /** Предуровневые бустеры: спецфишки на стартовой доске. */
  preBoosters: readonly TPreLevelBoosterKind[];
  /** Качество отрисовки: перф-гейт сам (`auto`) или зафиксировано хостом. */
  quality: TRenderQualityMode;
  /** Подпись партии под доской; `null` - «Уровень N» по `id` уровня. */
  title: string | null;
  /** Какой рендерер просить у Pixi (`configs/renderer`). */
  renderer: TRendererMode;
}

const DEFAULT_PARTY_OPTIONS: IRuntimePartyOptions = {
  offersContinue: false,
  preBoosters: [],
  quality: 'auto',
  title: null,
  renderer: 'auto',
};

interface LevelConfigStore {
  levelConfig: LevelConfig | null;
  boosters: IGameStartBooster[];
  /** Зерно случайности партии: добор и перемешка доски (`BoardEngine`). */
  seed: number;
  partyOptions: IRuntimePartyOptions;
  setLevelConfig: (config: LevelConfig) => void;
  setBoosters: (boosters: IGameStartBooster[]) => void;
  setSeed: (seed: number) => void;
  setPartyOptions: (options: IRuntimePartyOptions) => void;
  clearLevelConfig: () => void;
}

export const useLevelConfigStore = create<LevelConfigStore>()((set) => ({
  levelConfig: null,
  boosters: [],
  seed: 0,
  partyOptions: DEFAULT_PARTY_OPTIONS,

  setLevelConfig: (config) => set({ levelConfig: config }),
  setBoosters: (boosters) => set({ boosters }),
  setSeed: (seed) => set({ seed }),
  setPartyOptions: (partyOptions) => set({ partyOptions }),

  clearLevelConfig: () =>
    set({ levelConfig: null, boosters: [], seed: 0, partyOptions: DEFAULT_PARTY_OPTIONS }),
}));
