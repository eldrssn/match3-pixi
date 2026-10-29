import {
  listLevelMechanics,
  type IGameStartBooster,
  type IMinigameLevelConfig,
  type TLevelMechanic,
  type TPreLevelBoosterKind,
} from '@/entities/game';
import { DEFAULT_LEVEL_BOOSTERS } from '@/entities/level';
import { formatScore } from '@/shared/lib/format';
import type { IGameOutcome } from '@/widgets/game';
import { EDITOR_TEXTS } from './texts';

/**
 * Что превью редактора передаёт партии. Превью - тот же экран партии, что на
 * главной (`GameScreenLazy`), а редактор здесь - его хост: бустеры,
 * подсказки и зерно решает он, виджет про каталог не знает.
 */
export interface IEditorPreviewOptions {
  /** Обычные бустеры партии (`DEFAULT_LEVEL_BOOSTERS`), как на уровнях пака после первого. */
  boosters: boolean;
  /** Предуровневые бустеры - то, что игрок выбрал бы на карточке уровня. */
  preBoosters: TPreLevelBoosterKind[];
  /** Подсказки всех механик уровня перед первым ходом - как у новичка. */
  tutorial: boolean;
  /**
   * На исходе ходов - предложение «+ходы» (near-miss) по общему правилу хоста
   * (`features/match3Host` `resolveContinueOffer`), иначе сразу поражение.
   */
  offersContinue: boolean;
  /** Зерно партии: та же раскладка добора на каждом «Заново». `null` - случайное. */
  seed: number | null;
  /** Отладочные кнопки исхода поверх доски. */
  debug: boolean;
}

export const DEFAULT_EDITOR_PREVIEW_OPTIONS: IEditorPreviewOptions = {
  boosters: true,
  preBoosters: [],
  tutorial: false,
  offersContinue: true,
  seed: null,
  debug: true,
};

export interface IEditorPreviewParty {
  boosters: IGameStartBooster[];
  preBoosters: TPreLevelBoosterKind[];
  tutorial: TLevelMechanic[];
  seed: number | undefined;
}

export const resolvePreviewParty = (
  level: IMinigameLevelConfig,
  options: IEditorPreviewOptions
): IEditorPreviewParty => ({
  boosters: options.boosters ? DEFAULT_LEVEL_BOOSTERS : [],
  preBoosters: options.preBoosters,
  tutorial: options.tutorial ? listLevelMechanics(level) : [],
  seed: options.seed ?? undefined,
});

/** Зерно из поля ввода: целое неотрицательное или «случайное». */
export const parsePreviewSeed = (text: string): number | null => {
  const value = Number(text);

  return text.trim() !== '' && Number.isInteger(value) && value >= 0 ? value : null;
};

export const togglePreBooster = (
  selected: readonly TPreLevelBoosterKind[],
  kind: TPreLevelBoosterKind
): TPreLevelBoosterKind[] =>
  selected.includes(kind) ? selected.filter((item) => item !== kind) : [...selected, kind];

const MAX_STARS = 3;

/** Строка исхода партии превью: победа или поражение, очки, звёзды. */
export const describeOutcome = ({ isVictory, score, stars }: IGameOutcome): string =>
  [
    isVictory ? EDITOR_TEXTS.preview.victory : EDITOR_TEXTS.preview.defeat,
    EDITOR_TEXTS.preview.score(formatScore(score)),
    stars === null
      ? EDITOR_TEXTS.preview.noStars
      : EDITOR_TEXTS.preview.starFilled.repeat(stars) +
        EDITOR_TEXTS.preview.starEmpty.repeat(MAX_STARS - stars),
  ].join(' · ');
