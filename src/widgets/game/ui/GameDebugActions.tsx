import { useRef } from 'react';
import { COMBO_PHRASES } from '../lib/comboPhrases';
import { useComboPhraseStore } from '../store/comboPhraseStore';
import { useGameStore } from '../store/GameStore';
import { useLevelConfigStore } from '../store/levelConfigStore';
import { GAME_TEXTS } from '../texts';
import styles from './GameDebugActions.module.scss';

interface IGameDebugActionsProps {
  /** Та же отправка исхода, что и из рантайма (`useGameRuntimeEvents`). */
  onFinish: (isVictory: boolean) => void;
}

/**
 * Отладочные кнопки поверх доски (проп `debug` у экрана партии): ручной исход
 * и перебор хайп-фраз. Ручное завершение партии - отладка, а не часть экрана:
 * без флага любой игрок мог бы выиграть уровень, не сыграв.
 */
export const GameDebugActions = ({ onFinish }: IGameDebugActionsProps) => {
  // По клику показываем следующую хайп-фразу по кругу, чтобы проверить вёрстку
  // баннера, не дожидаясь редкого ролла в каскаде.
  const comboPhraseIndexRef = useRef(0);
  // Зерно на виду: QA переносит его в `?seed=` и повторяет раскладку.
  const seed = useLevelConfigStore((state) => state.seed);
  // Перф-гейт на виду: FPS последней секунды и качество, до которого он
  // опустил отрисовку (`PerfMonitor`).
  const fps = useGameStore((state) => state.fps);
  const renderQuality = useGameStore((state) => state.renderQuality);
  // Рендерер, который реально поднялся: `?renderer=webgpu` - лишь просьба.
  const rendererKind = useGameStore((state) => state.rendererKind);

  const showNextPhrase = () => {
    const phrase = COMBO_PHRASES[comboPhraseIndexRef.current % COMBO_PHRASES.length];
    comboPhraseIndexRef.current += 1;
    useComboPhraseStore.getState().showComboPhrase(phrase);
  };

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.actionButton} onClick={() => onFinish(true)}>
        {GAME_TEXTS.debug.win}
      </button>
      <button type="button" className={styles.actionButton} onClick={() => onFinish(false)}>
        {GAME_TEXTS.debug.lose}
      </button>
      <button type="button" className={styles.actionButton} onClick={showNextPhrase}>
        {GAME_TEXTS.debug.phrase}
      </button>
      <span className={styles.seed}>
        seed {seed} · {fps} fps · {renderQuality} · {rendererKind ?? '…'}
      </span>
    </div>
  );
};
