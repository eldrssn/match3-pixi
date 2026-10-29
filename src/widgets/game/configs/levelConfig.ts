import { useLevelConfigStore } from '@/widgets/game/store/levelConfigStore';

// Экспортируем функцию из стора для получения актуального конфига
export const getLevelConfig = () => {
  return useLevelConfigStore.getState().levelConfig;
};

export const getStartBoosters = () => useLevelConfigStore.getState().boosters;

/** Зерно случайности партии (см. `setRuntimeLevelConfig`). */
export const getRuntimeSeed = () => useLevelConfigStore.getState().seed;

/**
 * Пороги второй и третьей звезды партии - одни на шкалу очков (`ScoreMeter`)
 * и исход (`useGameRuntimeEvents`). `undefined` - у уровня звёзд нет (или
 * рантайм уже снял уровень): шкала прячет звёзды, исход без оценки.
 */
export const getRuntimeStarScores = (): readonly [number, number] | undefined =>
  getLevelConfig()?.starScores;
