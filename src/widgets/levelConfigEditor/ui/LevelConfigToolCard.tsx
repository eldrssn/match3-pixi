import clsx from 'clsx';
import { EDITOR_TOOLS_BY_ID, type TEditorToolArea, type TEditorToolId } from '../model/editorTools';
import { EditorToolIcon } from './EditorToolIcon';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigToolCard.module.scss';

type LevelConfigToolCardProps = Readonly<{
  selectedToolId: TEditorToolId;
  hoveredToolId: TEditorToolId | null;
}>;

const SCHEME_SIZE = 5;
const SCHEME_CENTER = 2;

/** Задета ли клетка схемы эффектом спецфишки, стоящей в центре. */
const isSchemeCellHit = (area: TEditorToolArea, col: number, row: number): boolean => {
  const dx = Math.abs(col - SCHEME_CENTER);
  const dy = Math.abs(row - SCHEME_CENTER);

  switch (area) {
    case 'row':
      return dy === 0;
    case 'column':
      return dx === 0;
    case 'square':
      return dx <= 1 && dy <= 1;
    case 'cross':
      return dx + dy <= 1;
    case 'color':
      // Радуга снимает все фишки цвета - схема показывает «через одну».
      return (col + row) % 2 === 0;
  }
};

/** Схема 5×5: что бьёт спецфишка из центральной клетки. */
const AreaScheme = ({ area }: { area: TEditorToolArea }) => (
  <div className={styles.scheme} aria-hidden>
    {Array.from({ length: SCHEME_SIZE * SCHEME_SIZE }, (_, index) => {
      const col = index % SCHEME_SIZE;
      const row = Math.floor(index / SCHEME_SIZE);
      const isCenter = col === SCHEME_CENTER && row === SCHEME_CENTER;

      return (
        <span
          key={index}
          className={clsx(
            styles.schemeCell,
            isSchemeCellHit(area, col, row) && styles.schemeHit,
            isCenter && styles.schemeCenter
          )}
        />
      );
    })}
  </div>
);

/**
 * Что делает элемент палитры: наведённый, а без наведения - выбранный.
 * Для хэлперов - ещё из какой фигуры они рождаются и схема удара.
 */
export const LevelConfigToolCard = ({
  selectedToolId,
  hoveredToolId,
}: LevelConfigToolCardProps) => {
  const toolId = hoveredToolId ?? selectedToolId;
  const tool = EDITOR_TOOLS_BY_ID[toolId];
  const isPreview = hoveredToolId !== null && hoveredToolId !== selectedToolId;

  return (
    <section className={styles.card} aria-label={EDITOR_TEXTS.toolCard.aria} aria-live="polite">
      <div className={styles.icon}>
        <EditorToolIcon toolId={toolId} />
      </div>
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 className={styles.title}>{tool.label}</h2>
          <span className={styles.layer}>{tool.layerLabel}</span>
          <span className={styles.state}>
            {isPreview ? EDITOR_TEXTS.toolCard.hovered : EDITOR_TEXTS.toolCard.selected}
          </span>
        </div>
        <p className={styles.description}>{tool.description}</p>
        {tool.origin && (
          <p className={styles.origin}>{EDITOR_TEXTS.toolCard.origin(tool.origin)}</p>
        )}
      </div>
      {tool.area && <AreaScheme area={tool.area} />}
    </section>
  );
};
