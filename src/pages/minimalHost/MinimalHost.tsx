import { useState } from 'react';
import { DEFAULT_LEVEL_PACK, getPackLevel } from '@/entities/level';
import { resolvePartyBoosters } from '@/features/match3Host';
import { GAME_RUNTIME_FAILURE_TEXT, GameScreenLazy } from '@/widgets/game';
import styles from './MinimalHost.module.scss';

const LEVEL_NUMBER = 1;

/**
 * Самый короткий хост виджета партии - образец для копии шаблона, которая
 * пишет свой хост вместо главной (`docs/custom-host.md`). Маршрута у него нет,
 * но он лежит в `src` и проходит type-check и lint: пример, который не
 * собирается, тихо отстаёт от API. Подключить вместо главной:
 * `<Route path={ROUTES.MAIN} element={<MinimalHost />} />`.
 *
 * Он не знает ни `pages/main`, ни `widgets/modals`: только уровень пака,
 * правило бустеров и сам виджет.
 */
export const MinimalHost = () => {
  const [partyId, setPartyId] = useState(0);
  // Чем кончилась партия; `null` - идёт. Пока партия кончена, экрана партии
  // нет: новый монтируется отдельным коммитом, когда старый рантайм уже умер.
  const [ended, setEnded] = useState<string | null>(null);
  const level = getPackLevel(DEFAULT_LEVEL_PACK, LEVEL_NUMBER);

  const restart = () => {
    setEnded(null);
    // Одна партия - один маунт: «Ещё раз» - новый `key`, а не смена `level`.
    setPartyId((id) => id + 1);
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        {level && ended === null ? (
          <GameScreenLazy
            key={partyId}
            level={level}
            boosters={resolvePartyBoosters(LEVEL_NUMBER)}
            onFinish={({ isVictory, score }) =>
              setEnded(`${isVictory ? 'Победа' : 'Поражение'} · ${score}`)
            }
            onExitRequest={() => setEnded('Партия закрыта')}
            onError={(failure) => setEnded(GAME_RUNTIME_FAILURE_TEXT[failure].title)}
          />
        ) : null}

        {ended !== null ? (
          <div className={styles.result} role="status">
            <p>{ended}</p>
            <button type="button" onClick={restart}>
              Ещё раз
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
};
