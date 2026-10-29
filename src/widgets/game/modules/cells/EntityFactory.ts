import type { TBoardPiece } from '@/entities/game';
import type { BoardEntity, IBoardEntityPlace } from './BoardEntity';
import { BOARD_VIEWS, resolveBoardViewKey, type TBoardViewFactory } from './boardViews';

/**
 * Создаёт сущность фишки движка (`BoardEngine`) в клетке и сразу её рисует.
 * Какой класс встанет, решает реестр видов (`BOARD_VIEWS`), а не `switch`
 * здесь: новый элемент заводится строкой в реестре.
 *
 * Рендер живёт здесь, а не в конструкторе `BoardEntity`: собственные поля
 * наследников (`LaserEntity.direction`) присваиваются уже после `super()`,
 * поэтому рендер из конструктора видел бы их `undefined`. Вызывающая сторона
 * повторно `render()` звать не должна: каждый лишний вызов пересоздаёт спрайт.
 */
export const createEntityFromPiece = (
  piece: Readonly<TBoardPiece>,
  place: IBoardEntityPlace
): BoardEntity => {
  // Ключ и фишка связаны по построению (`resolveBoardViewKey`), но эту
  // связь компилятор через объединение фабрик не протаскивает.
  const createView = BOARD_VIEWS[resolveBoardViewKey(piece.id)] as TBoardViewFactory;
  const entity = createView(piece, place);

  entity.render();

  return entity;
};
