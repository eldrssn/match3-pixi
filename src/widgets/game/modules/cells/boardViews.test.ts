import { describe, expect, it } from 'vitest';
import {
  MINIGAME_CHIP_IDS,
  MINIGAME_PIECE_IDS,
  MINIGAME_RANDOM_ID,
  MINIGAME_SPECIAL_IDS,
  type TBoardPiece,
} from '@/entities/game';
import { BOARD_VIEWS, resolveBoardViewKey } from './boardViews';

/** Всё, что движок кладёт на доску предметом: «?» до доски не доживает. */
const BOARD_PIECE_IDS = [
  ...MINIGAME_PIECE_IDS.filter((id) => id !== MINIGAME_RANDOM_ID),
  ...MINIGAME_SPECIAL_IDS,
] as TBoardPiece['id'][];

describe('BOARD_VIEWS', () => {
  it('у каждого предмета движка есть вид на доске', () => {
    expect(
      BOARD_PIECE_IDS.filter((id) => typeof BOARD_VIEWS[resolveBoardViewKey(id)] !== 'function')
    ).toEqual([]);
  });

  it('все цвета фишек рисует один вид: новый цвет вида не требует', () => {
    expect(new Set(MINIGAME_CHIP_IDS.map(resolveBoardViewKey))).toEqual(new Set(['chip']));
  });

  it('остальные элементы ищут вид по своему коду', () => {
    expect(resolveBoardViewKey('stone')).toBe('stone');
    expect(resolveBoardViewKey('laser')).toBe('laser');
  });
});
