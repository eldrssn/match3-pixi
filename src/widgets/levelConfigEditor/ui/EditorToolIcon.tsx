import clsx from 'clsx';
import EraserIcon from '@/assets/icons/editor/eraser.svg?react';
import { getElementIcon } from '@/entities/skin';
import { resolveToolElementId, type TEditorToolId } from '../model/editorTools';
import styles from './EditorToolIcon.module.scss';

type EditorToolIconProps = Readonly<{
  toolId: TEditorToolId;
  className?: string;
}>;

/**
 * Иконка инструмента редактора - одна на плитку палитры, клетку поля и
 * карточку описания: иконка элемента из скина (та же, что у целей на
 * карточках и подсказок механик). Вертикальная ракета - та же иконка,
 * повёрнутая на четверть; у ластика элемента нет - контурный глиф.
 */
export const EditorToolIcon = ({ toolId, className }: EditorToolIconProps) => {
  if (toolId === 'erase') {
    return <EraserIcon className={clsx(styles.icon, styles.glyph, className)} aria-hidden />;
  }

  const url = getElementIcon(resolveToolElementId(toolId) ?? undefined);

  if (!url) {
    return null;
  }

  return (
    <img
      className={clsx(styles.icon, toolId === 'laserVertical' && styles.vertical, className)}
      src={url}
      alt=""
      draggable={false}
    />
  );
};
