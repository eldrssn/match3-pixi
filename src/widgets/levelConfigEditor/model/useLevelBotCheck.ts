import { useEffect, useRef, useState } from 'react';
import { validateMinigameLevelConfig, type IMinigameLevelConfig } from '@/entities/game';
import {
  listBotCheckRuns,
  playBotCheckRun,
  summarizeBotCheck,
  type IBotCheckRun,
  type ILevelBotCheckResult,
} from './levelBotCheck';

export type TLevelBotCheckState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'done'; result: ILevelBotCheckResult; checkedConfig: IMinigameLevelConfig }
  | { status: 'invalid' };

/**
 * Проверка черновика ботом-солвером: две модели игрока по дюжине партий. Партии
 * идут по одной между кадрами (`setTimeout`): партия на поле 9×9 - десятки
 * миллисекунд, и все разом заморозили бы редактор на секунду-другую.
 * Черновик с ошибками валидации бот не играет - движок на нём бросил бы.
 */
export const useLevelBotCheck = () => {
  const [state, setState] = useState<TLevelBotCheckState>({ status: 'idle' });
  const timerRef = useRef<number | null>(null);

  const stop = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => stop, []);

  const run = (config: IMinigameLevelConfig) => {
    stop();

    if (validateMinigameLevelConfig(config).length > 0) {
      setState({ status: 'invalid' });
      return;
    }

    const plan = listBotCheckRuns();
    const results: IBotCheckRun[] = [];

    const next = () => {
      results.push(playBotCheckRun(config, plan[results.length]));

      if (results.length < plan.length) {
        setState({ status: 'running', done: results.length, total: plan.length });
        timerRef.current = window.setTimeout(next, 0);
        return;
      }

      timerRef.current = null;
      setState({
        status: 'done',
        result: summarizeBotCheck(config, results),
        checkedConfig: config,
      });
    };

    setState({ status: 'running', done: 0, total: plan.length });
    timerRef.current = window.setTimeout(next, 0);
  };

  return { state, run };
};
