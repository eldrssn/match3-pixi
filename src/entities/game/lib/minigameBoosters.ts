/**
 * Виды бустеров рантайма - совпадают с именами спрайтов (`ball`/`beam`/`laser`).
 * Порядок - порядок раскладки бустеров в `GameStore`: она всегда содержит все
 * три вида, даже если партия выдала только часть.
 */
export const GAME_BOOSTER_KINDS = ['beam', 'laser', 'ball'] as const;

export type TGameBoosterKind = (typeof GAME_BOOSTER_KINDS)[number];

/**
 * Предуровневые бустеры: спецфишки, которые игрок берёт с собой в партию до
 * её начала (ракета, бомба, радуга - как в Royal Match). Движок ставит их на
 * случайные свободные фишки стартовой доски (`BoardEngine.placeStartSpecials`).
 * Коды - те же, что у спецфишек движка.
 */
export const PRE_LEVEL_BOOSTER_KINDS = ['laser', 'bomb', 'rainbow'] as const;

export type TPreLevelBoosterKind = (typeof PRE_LEVEL_BOOSTER_KINDS)[number];

export const isPreLevelBoosterKind = (value: string): value is TPreLevelBoosterKind =>
  (PRE_LEVEL_BOOSTER_KINDS as readonly string[]).includes(value);
