import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigGridActions.module.scss';

type LevelConfigGridActionsProps = Readonly<{
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRegenerateChips: () => void;
  onGenerate: () => void;
  onRandomize: () => void;
  onClear: () => void;
}>;

/** Действия над полем черновика: отмена и повтор, генерация, «?», очистка. */
export const LevelConfigGridActions = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRegenerateChips,
  onGenerate,
  onRandomize,
  onClear,
}: LevelConfigGridActionsProps) => (
  <>
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={onUndo}
        disabled={!canUndo}
        title="Ctrl+Z"
      >
        {EDITOR_TEXTS.gridActions.undo}
      </button>
      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={onRedo}
        disabled={!canRedo}
        title="Ctrl+Shift+Z"
      >
        {EDITOR_TEXTS.gridActions.redo}
      </button>
    </div>
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.button}
        onClick={onRegenerateChips}
        title={EDITOR_TEXTS.gridActions.regenerateChipsTitle}
      >
        {EDITOR_TEXTS.gridActions.regenerateChips}
      </button>
      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={onGenerate}
        title={EDITOR_TEXTS.gridActions.generateTitle}
      >
        {EDITOR_TEXTS.gridActions.generate}
      </button>
      <button type="button" className={styles.buttonSecondary} onClick={onRandomize}>
        {EDITOR_TEXTS.gridActions.randomize}
      </button>
      <button type="button" className={styles.buttonSecondary} onClick={onClear}>
        {EDITOR_TEXTS.gridActions.clear}
      </button>
    </div>
  </>
);
