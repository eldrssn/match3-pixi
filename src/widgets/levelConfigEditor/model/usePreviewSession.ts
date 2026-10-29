import { useEffect, useRef, useState } from 'react';
import { resolveContinueOffer } from '@/features/match3Host';
import type { IGameOutcome, IOutOfMovesOffer, TGameRuntimeFailure } from '@/widgets/game';
import {
  DEFAULT_EDITOR_PREVIEW_OPTIONS,
  parsePreviewSeed,
  type IEditorPreviewOptions,
} from './previewOptions';

/** Чем кончилась партия превью; `null` - идёт. */
export type TPreviewStatus =
  | { kind: 'finished'; outcome: IGameOutcome }
  | { kind: 'exited' }
  | { kind: 'failed'; failure: TGameRuntimeFailure };

export interface IPreviewContinue {
  offer: IOutOfMovesOffer;
  extraMoves: number;
}

/**
 * Сессия превью: настройки партии, ключ текущей партии, её исход и
 * предложение «+ходы».
 *
 * Одна партия - один маунт: любая смена (ревизия уровня, настройка, «Заново»)
 * - новый ключ. Живой рантайм в приложении один (`GameStore` -
 * синглтон), а старый экран отпускает рантайм отложенно (микротаской после
 * cleanup), поэтому новый экран монтируется не в том же коммите, а
 * следующей задачей (`isMounted`): между ними старый рантайм успевает умереть
 * и не сбрасывает стор уже поднятого нового.
 *
 * Исход и предложение привязаны к ключу партии: «Продолжить» прошлой партии
 * звал бы мёртвый рантайм.
 */
export const usePreviewSession = (configRevision: number) => {
  const [options, setOptions] = useState<IEditorPreviewOptions>(DEFAULT_EDITOR_PREVIEW_OPTIONS);
  const [seedText, setSeedText] = useState('');
  const [optionsRevision, setOptionsRevision] = useState(0);
  const sessionKey = `${configRevision}:${optionsRevision}`;
  const [mountedKey, setMountedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ key: string; value: TPreviewStatus } | null>(null);
  const continuesUsedRef = useRef(0);
  const [continueOffer, setContinueOffer] = useState<(IPreviewContinue & { key: string }) | null>(
    null
  );
  const currentContinue = continueOffer?.key === sessionKey ? continueOffer : null;
  const currentStatus = status?.key === sessionKey ? status.value : null;
  const isMounted =
    mountedKey === sessionKey &&
    currentStatus?.kind !== 'exited' &&
    currentStatus?.kind !== 'failed';

  useEffect(() => {
    continuesUsedRef.current = 0;

    const timer = window.setTimeout(() => setMountedKey(sessionKey), 0);

    return () => window.clearTimeout(timer);
  }, [sessionKey]);

  const updateOptions = (patch: Partial<IEditorPreviewOptions>) => {
    setOptions((current) => ({ ...current, ...patch }));
    setOptionsRevision((revision) => revision + 1);
  };

  /** Зерно - по уходу из поля: поле нормализуется, новая партия - только на смене зерна. */
  const commitSeed = () => {
    const seed = parsePreviewSeed(seedText);

    setSeedText(seed === null ? '' : String(seed));

    if (seed !== options.seed) {
      updateOptions({ seed });
    }
  };

  const finishWith = (value: TPreviewStatus) => {
    setStatus({ key: sessionKey, value });
  };

  const handleOutOfMoves = (offer: IOutOfMovesOffer) => {
    const extraMoves = resolveContinueOffer(continuesUsedRef.current);

    if (extraMoves === null) {
      offer.giveUp();
      return;
    }

    setContinueOffer({ key: sessionKey, offer, extraMoves });
  };

  const resolveContinue = (accept: boolean) => {
    if (!currentContinue) {
      return;
    }

    setContinueOffer(null);

    if (accept) {
      continuesUsedRef.current += 1;
      currentContinue.offer.continueWith(currentContinue.extraMoves);
    } else {
      currentContinue.offer.giveUp();
    }
  };

  return {
    options,
    seedText,
    sessionKey,
    isMounted,
    currentStatus,
    currentContinue: currentContinue as IPreviewContinue | null,
    setSeedText,
    commitSeed,
    updateOptions,
    finishWith,
    handleOutOfMoves,
    resolveContinue,
  };
};

/** Сессия превью: её делят настройки (рабочее место) и сама партия (колонка превью). */
export type TPreviewSession = ReturnType<typeof usePreviewSession>;
