import clsx from 'clsx';
import { PRE_LEVEL_BOOSTER_KINDS } from '@/entities/game';
import { getElementLabel } from '@/entities/skin';
import { NEAR_MISS_EXTRA_MOVES } from '@/features/match3Host';
import { togglePreBooster, type IEditorPreviewOptions } from '../model/previewOptions';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigPreviewControls.module.scss';

type LevelConfigPreviewControlsProps = Readonly<{
  options: IEditorPreviewOptions;
  seedText: string;
  onOptionsChange: (patch: Partial<IEditorPreviewOptions>) => void;
  onSeedTextChange: (text: string) => void;
  onSeedCommit: () => void;
  onRestart: () => void;
}>;

/** Флажки настроек превью - по ключу `IEditorPreviewOptions` и подписи. */
const TOGGLES = [
  { key: 'boosters', label: EDITOR_TEXTS.preview.boosters },
  { key: 'tutorial', label: EDITOR_TEXTS.preview.tutorial },
  { key: 'offersContinue', label: EDITOR_TEXTS.preview.offersContinue(NEAR_MISS_EXTRA_MOVES) },
  { key: 'debug', label: EDITOR_TEXTS.preview.debug },
] as const;

/**
 * Настройки партии превью: бустеры, подсказки, «+ходы», кнопки исхода,
 * предуровневые бустеры, зерно и «Заново». Каждая смена - новая партия
 * (`usePreviewSession`); зерно применяется по уходу из поля.
 */
export const LevelConfigPreviewControls = ({
  options,
  seedText,
  onOptionsChange,
  onSeedTextChange,
  onSeedCommit,
  onRestart,
}: LevelConfigPreviewControlsProps) => (
  <div className={styles.controls}>
    <div className={styles.toggles}>
      {TOGGLES.map(({ key, label }) => (
        <label key={key} className={styles.toggle}>
          <input
            type="checkbox"
            checked={options[key]}
            onChange={(event) => onOptionsChange({ [key]: event.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>

    <div className={styles.row} role="group" aria-label={EDITOR_TEXTS.preview.preBoostersAria}>
      <span className={styles.rowLabel}>{EDITOR_TEXTS.preview.preBoosters}</span>
      {PRE_LEVEL_BOOSTER_KINDS.map((kind) => {
        const isActive = options.preBoosters.includes(kind);

        return (
          <button
            key={kind}
            type="button"
            className={clsx(styles.chip, isActive && styles.chipActive)}
            aria-pressed={isActive}
            onClick={() =>
              onOptionsChange({ preBoosters: togglePreBooster(options.preBoosters, kind) })
            }
          >
            {getElementLabel(kind)}
          </button>
        );
      })}
    </div>

    <div className={styles.row}>
      <label className={styles.seed}>
        {EDITOR_TEXTS.preview.seed}
        <input
          className={styles.seedInput}
          inputMode="numeric"
          placeholder={EDITOR_TEXTS.preview.seedPlaceholder}
          value={seedText}
          onChange={(event) => onSeedTextChange(event.target.value)}
          onBlur={onSeedCommit}
        />
      </label>
      <button type="button" className={styles.restart} onClick={onRestart}>
        {EDITOR_TEXTS.preview.restart}
      </button>
    </div>
  </div>
);
