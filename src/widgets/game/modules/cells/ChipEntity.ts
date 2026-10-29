import { isMinigameChipId } from '@/entities/game';
import { BoardEntity, type IBoardEntityPlace } from './BoardEntity';
import type { CellId, ChipColor } from './cellsTypes';

export function isChipColor(id: CellId): id is ChipColor {
  return isMinigameChipId(id);
}

export class ChipEntity extends BoardEntity {
  public color: ChipColor;

  constructor(id: CellId, hp: number, place: IBoardEntityPlace) {
    super(id, hp, place);

    if (!isChipColor(id)) {
      throw new Error(`Invalid chip color: ${id}`);
    }
    this.color = id;
  }

  matches(color: string): boolean {
    return this.color === color;
  }
}
