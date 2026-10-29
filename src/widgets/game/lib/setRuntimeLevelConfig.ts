import type { IGameStartBooster } from '@/entities/game';
import { createRandomSeed, normalizeSeed } from '@/shared/lib/random';
import { resolveStartRenderQuality } from '../configs/renderQuality';
import { applyRenderQuality } from './applyRenderQuality';
import {
  useLevelConfigStore,
  type IRuntimePartyOptions,
  type LevelConfig,
} from '../store/levelConfigStore';

/**
 * Подкладывает рантайму уровень, стартовые бустеры, зерно и настройки партии
 * до старта рантайма: он читает их из `levelConfigStore` при создании. Здесь
 * же выставляется стартовое качество отрисовки - единственный вход режима
 * `quality`: от него зависит DPR первого замера канваса,
 * а он случается раньше старта рантайма.
 *
 * Вызывает его только экран партии (`useGameRuntime`, уровень из пропсов) - и у
 * главной, и в превью редактора: свой запуск у редактора отставал бы от партии
 * на все правки доски.
 *
 * Без бустеров панель бустеров скрыта (`areBoostersHiddenForParty`). Без зерна
 * партия получает случайное: детерминированным становится всё, что после него.
 */
export const setRuntimeLevelConfig = (
  levelConfig: LevelConfig,
  boosters: IGameStartBooster[] = [],
  seed?: number,
  options: Partial<IRuntimePartyOptions> = {}
): void => {
  const store = useLevelConfigStore.getState();

  store.setLevelConfig(levelConfig);
  store.setBoosters(boosters);
  store.setSeed(seed === undefined ? createRandomSeed() : normalizeSeed(seed));

  const quality = options.quality ?? 'auto';

  store.setPartyOptions({
    offersContinue: options.offersContinue ?? false,
    preBoosters: options.preBoosters ?? [],
    quality,
    title: options.title ?? null,
    renderer: options.renderer ?? 'auto',
  });
  applyRenderQuality(resolveStartRenderQuality(quality));
};

export type { IRuntimePartyOptions, LevelConfig };
