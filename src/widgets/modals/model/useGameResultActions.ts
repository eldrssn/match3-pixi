import { useMemo } from 'react';
import {
  resolveGameResultActions,
  type TGameResultActionId,
  type TGameResultModalKey,
} from './resolveGameResultActions';
import { useHideModal, useModalProps } from './useModalsStore';

export type { TGameResultModalKey };

export interface IGameResultAction {
  id: TGameResultActionId;
  label: string;
  variant: 'primary' | 'secondary';
  onClick: () => void;
}

interface IGameResultActions {
  /** Кнопки результата в порядке показа. */
  actions: IGameResultAction[];
  /** Закрытие карточки (Escape) - то же, что «На главную». */
  close: () => void;
}

/**
 * Правила геймфлоу для модалок результата - одни и те же для победы и
 * поражения, поэтому живут в модели, а не дублируются в двух компонентах.
 * Наружу выходит готовый набор кнопок, а не отдельные действия: какой набор
 * показать - это то же самое правило, и разводить его между моделью и двумя
 * вью означало бы третью трактовку одного вопроса.
 *
 * Что делает каждая кнопка, решает хост партии: обработчики приходят пропсами
 * модалки (`IGameResultModalProps`). Карточка закрывается в том же
 * React-коммите, что и действие хоста, так что промежуточного кадра с голым
 * экраном не будет.
 *
 * Закрытие без выбора ведёт на главную: под карточкой доски уже нет, и
 * «просто закрыть» оставило бы игрока перед пустым фоном партии.
 */
export const useGameResultActions = (resultKey: TGameResultModalKey): IGameResultActions => {
  const hideModal = useHideModal();
  const props = useModalProps(resultKey);

  return useMemo(() => {
    const run = (action?: () => void) => () => {
      hideModal(resultKey);
      action?.();
    };

    return {
      actions: resolveGameResultActions(resultKey).map((def) => ({
        ...def,
        onClick: run(def.id === 'go-home' ? props?.onHome : props?.onPlay),
      })),
      close: run(props?.onHome),
    };
  }, [hideModal, props, resultKey]);
};
