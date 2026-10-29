import { Suspense, lazy } from 'react';
import type { IGameScreenProps } from '../model/gameScreenTypes';
import { GameLoadingShell } from './GameLoadingShell';
import { importGameScreen } from './gameScreenChunk';

const GameScreen = lazy(() =>
  importGameScreen().then((module) => ({ default: module.GameScreen }))
);

/**
 * Точка входа в экран партии для хоста: сам экран приезжает отдельным чанком
 * вместе с рантаймом.
 *
 * Обычно чанк уже загружен - его греет нажатие на «Играть»
 * (`prefetchGameScreenChunk`). Suspense страхует остальные случаи: медленную
 * сеть и вход в партию сразу после загрузки приложения.
 *
 * Fallback - `GameLoadingShell`: он совпадает с загрузочным состоянием
 * `GameScreen`, поэтому подмена заглушки на экран не читается как отдельный
 * экран перехода.
 */
export const GameScreenLazy = (props: IGameScreenProps) => (
  <Suspense fallback={<GameLoadingShell />}>
    <GameScreen {...props} />
  </Suspense>
);
