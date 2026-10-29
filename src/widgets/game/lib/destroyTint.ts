import { getElementDestroyTint, SKIN } from '@/entities/skin';
import type { CellId } from '../modules/cells/cellsTypes';

/**
 * Цвет частиц разрушения элемента - из его описания в скине; у элемента без
 * своего цвета - общий цвет снопа (`colors.fx.burstDefault`).
 */
export const resolveDestroyTint = (cellId: CellId | 'ice' | 'chain' | 'floor'): number =>
  getElementDestroyTint(cellId) ?? SKIN.colors.fx.burstDefault;
