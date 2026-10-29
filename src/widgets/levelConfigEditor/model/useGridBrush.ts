import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import type { IMinigameLevelConfig } from '@/entities/game';
import {
  paintGridCell,
  parseEditorToolId,
  type IEditorCellPos,
  type TEditorToolId,
} from './editorTools';
import { listStrokeCells } from './levelConfigGrid';

type TGridChange = (config: IMinigameLevelConfig, options?: { merge?: boolean }) => void;

/**
 * Штрих кисти: что делает зажатая кнопка, какие клетки уже задеты и поле,
 * которое штрих собрал к этому моменту. Поле копится здесь, а не берётся из
 * пропса: события входа в клетку идут чаще рендеров, и правка соседней
 * клетки, ещё не дошедшая до пропса, иначе терялась бы.
 */
interface IStroke {
  toolId: TEditorToolId;
  visited: Set<string>;
  config: IMinigameLevelConfig;
  last: IEditorCellPos;
  /** Штрих уже записал правку: следующие клетки сливаются с ней. */
  recorded: boolean;
}

const cellKey = ({ col, row }: IEditorCellPos) => `${col}:${row}`;

/**
 * Ввод поля редактора: клик ставит инструмент, зажатая кнопка рисует кистью
 * (весь штрих - одна правка истории), правый клик стирает верхний слой,
 * плитку палитры можно перетащить на клетку. Плюс клетка под курсором.
 *
 * Штрих кончается на `pointerup` окна, а если кнопку отпустили за окном
 * браузера и `pointerup` не дошёл - на первом входе в клетку без зажатой
 * кнопки.
 */
export const useGridBrush = ({
  config,
  toolId,
  onChange,
}: {
  config: IMinigameLevelConfig;
  toolId: TEditorToolId;
  onChange: TGridChange;
}) => {
  const strokeRef = useRef<IStroke | null>(null);
  const [hovered, setHovered] = useState<IEditorCellPos | null>(null);

  useEffect(() => {
    const endStroke = () => {
      strokeRef.current = null;
    };

    window.addEventListener('pointerup', endStroke);
    window.addEventListener('pointercancel', endStroke);

    return () => {
      window.removeEventListener('pointerup', endStroke);
      window.removeEventListener('pointercancel', endStroke);
    };
  }, []);

  /** Новое поле штриха: правки не было - ничего, первая - новый шаг, дальше - слияние. */
  const commitStroke = (stroke: IStroke, next: IMinigameLevelConfig) => {
    if (next === stroke.config) {
      return;
    }

    stroke.config = next;

    if (stroke.recorded) {
      onChange(next, { merge: true });
    } else {
      stroke.recorded = true;
      onChange(next);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>, pos: IEditorCellPos) => {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    event.preventDefault();

    // Касание неявно захватывает указатель клеткой, где началось, и вход в
    // соседние клетки не приходит - кисть пальцем красила бы одну клетку.
    const { currentTarget } = event;

    if (currentTarget.hasPointerCapture?.(event.pointerId)) {
      currentTarget.releasePointerCapture(event.pointerId);
    }

    const strokeToolId = event.button === 2 ? 'erase' : toolId;
    const stroke: IStroke = {
      toolId: strokeToolId,
      visited: new Set([cellKey(pos)]),
      config,
      last: pos,
      recorded: false,
    };

    strokeRef.current = stroke;
    commitStroke(stroke, paintGridCell(config, pos, strokeToolId, 'click'));
  };

  const handlePointerEnter = (event: PointerEvent<HTMLElement>, pos: IEditorCellPos) => {
    setHovered(pos);

    const stroke = strokeRef.current;

    if (!stroke) {
      return;
    }

    if (event.buttons === 0) {
      strokeRef.current = null;
      return;
    }

    let next = stroke.config;

    for (const cell of listStrokeCells(stroke.last, pos)) {
      const key = cellKey(cell);

      if (!stroke.visited.has(key)) {
        stroke.visited.add(key);
        next = paintGridCell(next, cell, stroke.toolId, 'stroke');
      }
    }

    stroke.last = pos;
    commitStroke(stroke, next);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLElement>, pos: IEditorCellPos) => {
    event.preventDefault();

    const droppedId = parseEditorToolId(event.dataTransfer.getData('text/plain'));

    if (droppedId) {
      const next = paintGridCell(config, pos, droppedId, 'click');

      if (next !== config) {
        onChange(next);
      }
    }
  };

  return {
    hovered,
    handlePointerDown,
    handlePointerEnter,
    handleGridPointerLeave: () => setHovered(null),
    handleDragOver,
    handleDrop,
  };
};
