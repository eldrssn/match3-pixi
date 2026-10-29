import { useId, useRef, useState } from 'react';
import type { IEditorPack, IEditorPackOption } from '../model/editorWorkspace';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigPackSection.module.scss';

type LevelConfigPackSectionProps = Readonly<{
  pack: IEditorPack;
  options: readonly IEditorPackOption[];
  activeOption: IEditorPackOption | undefined;
  errors: readonly string[];
  onOpen: (packId: string) => void;
  onCreate: () => void;
  onTitleChange: (title: string) => void;
  onRename: (packId: string) => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onDiscard: () => void;
}>;

const describeOption = ({ id, title, isInRepo, hasDraft }: IEditorPackOption) =>
  `${title || id} (${id})${isInRepo ? '' : EDITOR_TEXTS.pack.newSuffix}${isInRepo && hasDraft ? EDITOR_TEXTS.pack.draftSuffix : ''}`;

/**
 * Пак уровней целиком: выбор пака, его id и название, выгрузка файлом для
 * `npm run levels:import` и загрузка такого файла обратно. Черновики живут в
 * браузере - отказ от черновика возвращает пак репозитория (новый пак
 * удаляет) в два нажатия: случайный клик не должен стирать работу.
 */
export const LevelConfigPackSection = ({
  pack,
  options,
  activeOption,
  errors,
  onOpen,
  onCreate,
  onTitleChange,
  onRename,
  onExport,
  onImport,
  onDiscard,
}: LevelConfigPackSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Набираемый id - черновик поля: пак переименовывается по blur или Enter,
  // а не на каждый символ (на полпути id чаще всего занят или неверен).
  // `null` - поле показывает id пака; отказ в переименовании его и вернёт.
  const [idDraft, setIdDraft] = useState<string | null>(null);
  const [isDiscardArmed, setIsDiscardArmed] = useState(false);
  const errorsId = useId();
  const isInRepo = activeOption?.isInRepo ?? false;
  const hasDraft = activeOption?.hasDraft ?? false;

  const commitId = () => {
    if (idDraft === null) {
      return;
    }

    const nextId = idDraft.trim();

    setIdDraft(null);

    if (nextId !== pack.id) {
      onRename(nextId);
    }
  };

  const readFile = (file: File | undefined) => {
    if (file) {
      void file.text().then(onImport);
    }
  };

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.pack.title}>
      <h2 className={styles.sectionTitle}>{EDITOR_TEXTS.pack.title}</h2>
      <select
        className={styles.select}
        aria-label={EDITOR_TEXTS.pack.select}
        value={pack.id}
        onChange={(event) => onOpen(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {describeOption(option)}
          </option>
        ))}
      </select>

      <div className={styles.fields}>
        <label className={styles.field}>
          {EDITOR_TEXTS.pack.packTitle}
          <input
            className={styles.input}
            value={pack.title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {EDITOR_TEXTS.pack.packId}
          <input
            className={styles.input}
            value={idDraft ?? pack.id}
            readOnly={isInRepo}
            title={isInRepo ? EDITOR_TEXTS.pack.repoIdTitle : ''}
            onChange={(event) => setIdDraft(event.target.value)}
            onBlur={commitId}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitId();
              } else if (event.key === 'Escape') {
                setIdDraft(null);
              }
            }}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onExport}>
          {EDITOR_TEXTS.pack.export}
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => fileInputRef.current?.click()}
        >
          {EDITOR_TEXTS.pack.import}
        </button>
        <button type="button" className={styles.buttonSecondary} onClick={onCreate}>
          {EDITOR_TEXTS.pack.create}
        </button>
        {hasDraft ? (
          <button
            type="button"
            className={styles.buttonDanger}
            onClick={() => {
              if (isDiscardArmed) {
                setIsDiscardArmed(false);
                onDiscard();
              } else {
                setIsDiscardArmed(true);
              }
            }}
            onBlur={() => setIsDiscardArmed(false)}
          >
            {isDiscardArmed
              ? EDITOR_TEXTS.pack.discardConfirm
              : isInRepo
                ? EDITOR_TEXTS.pack.discardToRepo
                : EDITOR_TEXTS.pack.remove}
          </button>
        ) : null}
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          accept="application/json,.json"
          aria-label={EDITOR_TEXTS.pack.fileInput}
          onChange={(event) => {
            readFile(event.target.files?.[0]);
            // Тот же файл можно выбрать снова: иначе `change` не придёт.
            event.target.value = '';
          }}
        />
      </div>

      {hasDraft ? <p className={styles.hint}>{EDITOR_TEXTS.pack.draftStoredHint}</p> : null}

      {errors.length > 0 ? (
        <details className={styles.errors} aria-labelledby={errorsId}>
          <summary id={errorsId} className={styles.errorsTitle}>
            {EDITOR_TEXTS.pack.errorsSummary(errors.length)}
          </summary>
          <ul className={styles.errorList}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
};
