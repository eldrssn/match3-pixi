/**
 * Тексты общих примитивов `shared` (подписи по умолчанию для скринридера,
 * словоформы). Свои тексты слоёв выше живут у них: `widgets/game/texts`,
 * `widgets/modals/texts`, `widgets/levelConfigEditor/model/texts`,
 * `pages/main/texts`, `entities/game/texts`, `entities/level/texts`.
 */
export const SHARED_TEXTS = {
  spinnerLabel: 'Загрузка',
  modalClose: 'Закрыть',
  movesWordForms: ['ход', 'хода', 'ходов'],
} as const;
