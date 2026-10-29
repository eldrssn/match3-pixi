/**
 * Загрузчик чанка экрана партии лежит отдельно от вью по той же причине, что и
 * `widgets/modals/ui/modalChunks`: и lazy-компонент, и предзагрузка должны
 * ссылаться на один и тот же динамический импорт. Любой статический импорт
 * `GameScreen` утянул бы за собой движок отрисовки в стартовый бандл, хотя
 * он нужен только внутри партии.
 */
export const importGameScreen = () => import('./GameScreen');

export const prefetchGameScreenChunk = (): void => {
  void importGameScreen().catch(() => undefined);
};
