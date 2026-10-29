import { lazy, type ReactElement } from 'react';
import type { TModalKey } from '../model/modal-registry';
import { importDefeat, importLevelStart, importOutOfMoves, importVictory } from './modalChunks';

// Продуктовый реестр модалок живёт в `widgets`, а не в `shared/modals`:
// примитив слоя ничего не знает о конкретных экранах приложения.
const ModalVictory = lazy(() =>
  importVictory().then((module) => ({ default: module.ModalVictory }))
);
const ModalDefeat = lazy(() => importDefeat().then((module) => ({ default: module.ModalDefeat })));
const ModalLevelStart = lazy(() =>
  importLevelStart().then((module) => ({ default: module.ModalLevelStart }))
);
const ModalOutOfMoves = lazy(() =>
  importOutOfMoves().then((module) => ({ default: module.ModalOutOfMoves }))
);

export interface IModalViewProps {
  isOpened: boolean;
}

type TModalView = (view: IModalViewProps) => ReactElement;

// Пропсы модалки результата (действия хоста) карточка читает из стора сама
// (`useGameResultActions`), поэтому вью получают только признак показа.
// `Record` по всем ключам реестра: новая модалка без вью не скомпилируется,
// а не отрисуется молча пустотой.
const MODAL_VIEWS: Record<TModalKey, TModalView> = {
  victory: ({ isOpened }) => <ModalVictory isOpened={isOpened} />,
  defeat: ({ isOpened }) => <ModalDefeat isOpened={isOpened} />,
  outOfMoves: ({ isOpened }) => <ModalOutOfMoves isOpened={isOpened} />,
  levelStart: ({ isOpened }) => <ModalLevelStart isOpened={isOpened} />,
};

export const renderModalView = (key: TModalKey, view: IModalViewProps): ReactElement =>
  MODAL_VIEWS[key](view);
