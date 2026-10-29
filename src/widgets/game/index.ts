export { GameScreenLazy } from './ui/GameScreenLazy';
export { prefetchGameScreenChunk } from './ui/gameScreenChunk';
export { warmGameAssets } from './lib/warmGameAssets';
export { warmPartyAssets } from './lib/warmPartyAssets';
export { GAME_RUNTIME_FAILURE_TEXT } from './model/gameRuntimeFailureText';
export type {
  IGameGoalLeft,
  IGameOutcome,
  IGameScreenCallbacks,
  IGameScreenProps,
  IOutOfMovesOffer,
} from './model/gameScreenTypes';
export type { TBoardEvent, TBoardEventType, TBoardSpecialSource } from './model/boardEvents';
export type { ISceneInsets } from './configs/sceneInsets';
export type { TRenderQualityMode } from './configs/renderQuality';
export type { TRendererMode } from './configs/renderer';
export type { TGameRuntimeFailure } from './store/GameStore';

/**
 * Этот баррель обязан оставаться свободным от движка отрисовки (Pixi, GSAP,
 * Spine) - сторож `barrelPixiFree.test.ts`.
 *
 * Его импортирует хост партии (`pages/main`) - модуль eager-графа входа,
 * поэтому всё, что отсюда экспортируется, попадает в стартовый чанк. Здесь
 * только lazy-обёртка, прогревы и типы; сам рантайм приезжает отдельным
 * чанком (`ui/gameScreenChunk`).
 *
 * Редактор уровней - такой же хост: его превью - тот же `GameScreenLazy`.
 * Отдельного API запуска рантайма наружу нет: он тянет движок статически, и
 * один его реэкспорт отсюда утянул бы движок в стартовую загрузку.
 */
