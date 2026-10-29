import { MODAL_TEXTS } from '../texts';
import type { MODAL_KEYS } from './modal-registry';

export type TGameResultModalKey = typeof MODAL_KEYS.VICTORY | typeof MODAL_KEYS.DEFEAT;

export type TGameResultActionId = 'next' | 'retry' | 'go-home';

export interface IGameResultActionDef {
  id: TGameResultActionId;
  label: string;
  variant: 'primary' | 'secondary';
}

/**
 * Какие кнопки показывает карточка результата.
 *
 * Победа: «Дальше» (следующий уровень) и «На главную». Поражение: «Ещё раз»
 * (тот же уровень) и «На главную». Чистое правило - покрыто тестом;
 * обработчики прикладывает `useGameResultActions`.
 */
export const resolveGameResultActions = (
  resultKey: TGameResultModalKey
): readonly IGameResultActionDef[] =>
  resultKey === 'victory'
    ? [
        { id: 'next', label: MODAL_TEXTS.result.next, variant: 'primary' },
        { id: 'go-home', label: MODAL_TEXTS.result.goHome, variant: 'secondary' },
      ]
    : [
        { id: 'retry', label: MODAL_TEXTS.result.retry, variant: 'primary' },
        { id: 'go-home', label: MODAL_TEXTS.result.goHome, variant: 'secondary' },
      ];
