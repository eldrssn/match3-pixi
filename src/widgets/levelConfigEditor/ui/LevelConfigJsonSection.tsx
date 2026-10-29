import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigJsonSection.module.scss';

type LevelConfigJsonSectionProps = Readonly<{
  jsonText: string;
  jsonError: string | null;
  onImport: (text: string) => void;
  onCopy: () => void;
  onDownload: () => void;
}>;

/**
 * JSON уровня: ручной импорт правкой текста плюс выгрузка. Свёрнут по
 * умолчанию - нужен редко, а места в колонке настроек занимает больше всех.
 */
export const LevelConfigJsonSection = ({
  jsonText,
  jsonError,
  onImport,
  onCopy,
  onDownload,
}: LevelConfigJsonSectionProps) => (
  <details className={styles.section} aria-label={EDITOR_TEXTS.json.aria}>
    <summary className={styles.sectionTitle}>{EDITOR_TEXTS.json.title}</summary>
    <textarea
      className={styles.textarea}
      value={jsonText}
      spellCheck={false}
      onChange={(event) => onImport(event.target.value)}
    />
    {jsonError && <div className={styles.jsonError}>{jsonError}</div>}
    <div className={styles.actions}>
      <button type="button" className={styles.buttonSecondary} onClick={onCopy}>
        {EDITOR_TEXTS.json.copy}
      </button>
      <button type="button" className={styles.buttonSecondary} onClick={onDownload}>
        {EDITOR_TEXTS.json.download}
      </button>
    </div>
  </details>
);
