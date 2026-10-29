import { useState } from 'react';
import type { TLevelMechanic } from '@/entities/game';
import { useGameStore } from '../store/GameStore';

interface IMechanicTipsView {
  /** Подсказка на экране; `undefined` - показывать нечего или интро ещё идёт. */
  currentTip: TLevelMechanic | undefined;
  /** Подсказка видна: доска стоит, тап по карточке не доходит до фишек. */
  isBlocking: boolean;
  /** «Понятно»: механика знакома хосту, дальше - следующая подсказка или ход. */
  dismiss: () => void;
}

/**
 * Обучение механикам (`IGameScreenProps.tutorial`): подсказки по одной, после
 * интро партии (`GameStore.isIntroFinished`) и до первого хода. Очередь
 * читается один раз - партия живёт один маунт, и смена пропа посреди неё
 * ничего не значит.
 */
export const useMechanicTips = (
  tutorial: readonly TLevelMechanic[] | undefined,
  onTutorialSeen: ((mechanic: TLevelMechanic) => void) | undefined
): IMechanicTipsView => {
  const [queue] = useState(() => [...(tutorial ?? [])]);
  const [index, setIndex] = useState(0);
  const isIntroFinished = useGameStore((state) => state.isIntroFinished);
  const currentTip = isIntroFinished ? queue[index] : undefined;

  const dismiss = () => {
    if (currentTip === undefined) {
      return;
    }

    onTutorialSeen?.(currentTip);
    setIndex((value) => value + 1);
  };

  return { currentTip, isBlocking: currentTip !== undefined, dismiss };
};
