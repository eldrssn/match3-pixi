import { getElementView, type TSkinCellView, type TSkinCellViewKind } from '@/entities/skin';
import type { ICellLook, ICellView, ICellViewPlace, TCellViewFactory } from './cellView';
import { FrameCellView } from './FrameCellView';
import { SpineCellView } from './SpineCellView';
import { SpriteCellView } from './SpriteCellView';

/**
 * Реестр видов клетки: способ рисования -> фабрика. Какой вид у элемента,
 * пишет скин (`ISkinElementBoard.view.kind`), а не `switch` здесь.
 *
 * Тип - запись по всем видам скина (`TSkinCellViewKind`): заведёте в скине
 * новый вид - без фабрики здесь не скомпилируется. `spine` - `SpineCellView`,
 * у которого `display` - объект скелета: сущностям доски от вида нужен
 * только `Container` (позиция, масштаб, прозрачность). Сам пакет Spine
 * фабрика не тянет: скелеты создаёт поддержка из ленивого чанка `spine`
 * (`core.spine`, `spine/spineSupport`), загруженная до сборки сцены.
 */
export const CELL_VIEW_KINDS: { readonly [K in TSkinCellViewKind]: TCellViewFactory<K> } = {
  sprite: (place, look) => new SpriteCellView(place, look),
  frames: (place, look, spec) => new FrameCellView(place, look, spec),
  spine: (place, look, spec) => new SpineCellView(place, look, spec),
};

/** Вид клетки элемента по описанию в скине. */
export const createCellView = (place: ICellViewPlace, look: ICellLook): ICellView => {
  const spec: TSkinCellView = getElementView(place.id);
  // Вид и его описание связаны по построению (`spec.kind`), но через
  // объединение фабрик компилятор эту связь не протаскивает.
  const create = CELL_VIEW_KINDS[spec.kind] as TCellViewFactory;

  return create(place, look, spec);
};
