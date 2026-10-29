/**
 * Публичная поверхность движка доски: сам движок, слои клетки и протокол
 * шагов. Гарды и прочность (`boardPieces`) - внутренняя кухня правил, наружу
 * не торчат, пока у них нет потребителя вне `entities/game`.
 */
export { BoardEngine } from './BoardEngine';
export type {
  IBoardCellSeed,
  IFloorPiece,
  ILaserPiece,
  IOverlayPiece,
  ISlimePiece,
  TBoardLayer,
  TBoardPiece,
  TBoardPieceSeed,
  TSpecialKind,
  TSpecialPiece,
} from './boardPieces';
export type {
  IBoardCellPos,
  IBoardChipPlacement,
  IBoardHit,
  IBoardMove,
  IBoardPlacement,
  IBoardSlimePlacement,
  IBoardSpawn,
  IBoardSpecialPlacement,
  IBoardTransform,
  TBoardBlast,
  TBoardDeadEndOutcome,
  TBoardStep,
  TBoardSwapOutcome,
} from './boardSteps';
