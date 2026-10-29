import clsx from 'clsx';
import type { IMinigameLevelConfig } from '@/entities/game';
// Баррель виджета без движка отрисовки: экран партии в нём ленивый (`GameScreenLazy`),
// сам рантайм приезжает своим чанком - тем же, что у главной.
import { GAME_RUNTIME_FAILURE_TEXT, GameScreenLazy } from '@/widgets/game';
import { describeOutcome, resolvePreviewParty } from '../model/previewOptions';
import { EDITOR_TEXTS } from '../model/texts';
import type { TPreviewSession } from '../model/usePreviewSession';
import styles from './LevelConfigPreview.module.scss';
import { LevelConfigPreviewContinue } from './LevelConfigPreviewContinue';

type LevelConfigPreviewProps = Readonly<{
  /** Применённый уровень; `null` - валидного ещё нет, партия не монтируется. */
  config: IMinigameLevelConfig | null;
  /** Сессия партии - у редактора: настройки превью стоят на рабочем месте. */
  session: TPreviewSession;
}>;

/**
 * Превью уровня - настоящий экран партии (`GameScreenLazy`), а редактор - его
 * хост, как главная: он решает бустеры, предуровневые бустеры, подсказки
 * механик, зерно и предложение «+ходы» (правило то же, что у главной, -
 * `features/match3Host` `resolveContinueOffer`; плашка своя, `LevelConfigPreviewContinue`, чтобы
 * редактор не зависел от модалок примера хоста). Своего запуска рантайма у превью нет - и не должно быть: копия
 * отставала бы от партии, и автор видел бы не ту игру, что игрок.
 *
 * Жизненный цикл партии (ключ, отложенный маунт, исход, «+ходы») - в
 * `usePreviewSession`, которым владеет редактор: настройки
 * (`LevelConfigPreviewControls`) стоят под полем, на рабочем месте.
 */
export const LevelConfigPreview = ({ config, session }: LevelConfigPreviewProps) => {
  const {
    options,
    sessionKey,
    isMounted,
    currentStatus,
    currentContinue,
    finishWith,
    handleOutOfMoves,
    resolveContinue,
  } = session;
  const party = config ? resolvePreviewParty(config, options) : null;
  const isPlaying = isMounted && config !== null && party !== null;

  return (
    <section className={styles.preview} aria-label={EDITOR_TEXTS.preview.aria}>
      <div className={styles.stage}>
        {isPlaying ? (
          <GameScreenLazy
            key={sessionKey}
            level={config}
            boosters={party.boosters}
            preBoosters={party.preBoosters}
            tutorial={party.tutorial}
            seed={party.seed}
            debug={options.debug}
            paused={currentContinue !== null}
            onFinish={(outcome) => finishWith({ kind: 'finished', outcome })}
            onOutOfMoves={options.offersContinue ? handleOutOfMoves : undefined}
            onExitRequest={() => finishWith({ kind: 'exited' })}
            onError={(failure) => {
              // Подробности сбоя рантайм уже написал в консоль.
              finishWith({ kind: 'failed', failure });
            }}
          />
        ) : null}

        {config === null ? (
          <div className={styles.notice} role="status">
            <strong className={styles.noticeTitle}>{EDITOR_TEXTS.preview.emptyTitle}</strong>
            <span>{EDITOR_TEXTS.preview.emptyText}</span>
          </div>
        ) : null}

        {isPlaying && currentContinue ? (
          <LevelConfigPreviewContinue
            goalsLeft={currentContinue.offer.goalsLeft}
            extraMoves={currentContinue.extraMoves}
            onContinue={() => resolveContinue(true)}
            onGiveUp={() => resolveContinue(false)}
          />
        ) : null}

        {currentStatus?.kind === 'finished' ? (
          <div className={styles.statusChip} role="status">
            {describeOutcome(currentStatus.outcome)}
          </div>
        ) : null}

        {currentStatus?.kind === 'exited' ? (
          <div className={styles.notice} role="status">
            <strong className={styles.noticeTitle}>{EDITOR_TEXTS.preview.exitedTitle}</strong>
            <span>{EDITOR_TEXTS.preview.exitedText}</span>
          </div>
        ) : null}

        {currentStatus?.kind === 'failed' ? (
          <div className={clsx(styles.notice, styles.noticeError)} role="alert">
            <strong className={styles.noticeTitle}>
              {GAME_RUNTIME_FAILURE_TEXT[currentStatus.failure].title}
            </strong>
            {/*
              Из общей таблицы - только заголовок: описание там для игрока
              («начните уровень заново»), а автору уровня нужно, что делать.
            */}
            <span>{EDITOR_TEXTS.preview.failedText}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
};
