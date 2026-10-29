import clsx from 'clsx';
import { Spinner } from '@/shared/ui/spinner';
import type { IGameScreenProps } from '../model/gameScreenTypes';
import { useGameRuntime } from '../model/useGameRuntime';
import { useGameRuntimeEvents } from '../model/useGameRuntimeEvents';
import { useMechanicTips } from '../model/useMechanicTips';
import { GAME_TEXTS } from '../texts';
import { ComboPhraseBanner } from './ComboPhraseBanner';
import { GameDebugActions } from './GameDebugActions';
import { MechanicTip } from './MechanicTip';
import styles from './GameScreen.module.scss';

/**
 * Экран партии - сам Match-3 виджет: Pixi-рантайм, баннер хайп-фразы и
 * спиннер загрузки. Про хост он ничего не знает: уровень и бустеры приходят
 * пропсами, а исход, запрос выхода и отказ рантайма уходят колбэками (см.
 * `IGameScreenProps`).
 *
 * Одна партия - один маунт: рантайм (`useGameRuntime`) поднимается при маунте и
 * уничтожается при размонтировании. Новую партию хост начинает новым `key`.
 * Живой рантайм в приложении обязан быть один, поэтому два экрана партии
 * одновременно монтировать нельзя.
 */
export const GameScreen = ({
  level,
  boosters,
  preBoosters,
  tutorial,
  paused = false,
  debug = false,
  insets,
  seed,
  quality,
  renderer,
  title,
  onFinish,
  onOutOfMoves,
  onTutorialSeen,
  onExitRequest,
  onError,
  onBoardEvent,
}: IGameScreenProps) => {
  const tips = useMechanicTips(tutorial, onTutorialSeen);
  // Пока видна подсказка механики, доска стоит так же, как под слоем хоста:
  // тап по карточке не должен доходить до фишек, а подсказка простоя -
  // отсчитываться.
  const isBoardLocked = paused || tips.isBlocking;
  const { gameContainerRef, boardRef, safeAreaRef, insetStyle, isLoading } = useGameRuntime({
    level,
    boosters,
    paused: isBoardLocked,
    insets,
    seed,
    offersContinue: onOutOfMoves !== undefined,
    preBoosters,
    quality,
    renderer,
    title,
  });
  const finish = useGameRuntimeEvents({
    onFinish,
    onOutOfMoves,
    onExitRequest,
    onError,
    onBoardEvent,
  });

  return (
    <section className={styles.screen} style={insetStyle} aria-label={GAME_TEXTS.screen.ariaLabel}>
      <div className={clsx(styles.board, isBoardLocked && styles.boardLocked)} ref={boardRef}>
        <div className={styles.canvasMount} ref={gameContainerRef} />
        <div className={styles.safeArea} ref={safeAreaRef} aria-hidden />
        <ComboPhraseBanner />
        {tips.currentTip ? (
          <MechanicTip mechanic={tips.currentTip} onDismiss={tips.dismiss} />
        ) : null}
        {/* `animateIn={false}`: спиннер приходит на смену уже видимому спиннеру
            заглушки (`GameLoadingShell`), и своя анимация входа дала бы
            просадку яркости ровно в момент подмены. `animateOut={false}`: за
            спиннером сразу начинается собственная анимация интро целей
            (`GameGoalsPannel`, затемнение + укрупнённая панель) - плавное
            затухание держало бы полупрозрачный спиннер поверх уже идущего
            интро ещё `motionDuration.base`, и получался лишний слой поверх
            цели вместо чистой подмены. */}
        <Spinner
          overlay
          noBg
          animateIn={false}
          animateOut={false}
          isActive={isLoading}
          ariaLabel={GAME_TEXTS.screen.loading}
        />
      </div>

      {/* Обычный исход партии приходит только из рантайма (`useGameRuntimeEvents`). */}
      {debug ? <GameDebugActions onFinish={finish} /> : null}
    </section>
  );
};
