import { useLevelConfigStore } from '../store/levelConfigStore';

/**
 * Правило скрытой панели бустеров: партия начата без бустеров. Хост сам решает,
 * в каких партиях бустеров нет (демо так ведёт первый уровень), а рантайм
 * только прячет пустую панель вместо трёх кнопок с нулём.
 *
 * Общее правило рантайма: им пользуются `BoostersContainer` (видимость самой
 * панели) и `BoosterButton` (видимость и интерактивность кнопки, плюс тап,
 * долетевший до канваса).
 *
 * Подписок не нужно: бустеры кладутся в стор до старта рантайма
 * (`setRuntimeLevelConfig`) и внутри партии не меняются - расход живёт в
 * `GameStore`, а не здесь.
 */
export const areBoostersHiddenForParty = (): boolean =>
  useLevelConfigStore.getState().boosters.length === 0;
