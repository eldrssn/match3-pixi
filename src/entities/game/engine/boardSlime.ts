import {
  BOARD_PIECE_HP,
  isChipPiece,
  isSlimePiece,
  type IChipPiece,
  type ISlimePiece,
} from './boardPieces';
import { NEIGHBOR_OFFSETS, type BoardState } from './boardState';
import type { IBoardCellPos, TBoardStep } from './boardSteps';

/**
 * Слизь расползается после хода игрока, который не снял ни одной её клетки:
 * случайная слизь занимает соседнюю свободную фишку (не под накладкой и не
 * спецфишку). Жанровое правило «шоколада» - слизь нельзя оставлять на потом,
 * иначе она съест поле. Ход - это свап и тап по спецфишке; бустер ходом не
 * считается и слизь не будит.
 *
 * Поглощённая фишка в цель не идёт: её никто не собирал. Гравитацию
 * расползание не трогает - клетка как была занята, так и осталась, только
 * теперь неподвижным блокером.
 */
export const spreadSlime = (board: BoardState, moveSteps: readonly TBoardStep[]): TBoardStep[] => {
  const isSlimeCleared = moveSteps.some(
    (step) => step.type === 'damage' && step.hits.some((hit) => hit.id === 'slime' && hit.destroyed)
  );

  if (isSlimeCleared) {
    return [];
  }

  const candidates: { from: IBoardCellPos; to: IBoardCellPos; chip: IChipPiece }[] = [];

  for (let col = 0; col < board.cols; col++) {
    for (let row = 0; row < board.rows; row++) {
      const piece = board.grid[col][row];

      if (!piece || !isSlimePiece(piece)) {
        continue;
      }

      for (const offset of NEIGHBOR_OFFSETS) {
        const to = { col: col + offset.col, row: row + offset.row };
        const target = board.cellAt(to);

        if (target && isChipPiece(target) && !board.overlays[to.col][to.row]) {
          candidates.push({ from: { col, row }, to, chip: target });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const { from, to, chip } = candidates[Math.floor(board.random() * candidates.length)];
  const slime: ISlimePiece = { uid: board.issueUid(), id: 'slime', hp: BOARD_PIECE_HP.slime };

  board.grid[to.col][to.row] = slime;

  return [{ type: 'spread', from, eaten: chip.uid, placement: { ...to, piece: { ...slime } } }];
};
