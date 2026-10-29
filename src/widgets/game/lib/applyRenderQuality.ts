import { setRenderQuality, type TRenderQuality } from '../configs/renderQuality';
import { useGameStore } from '../store/GameStore';

/**
 * Качество отрисовки партии - одной записью: модульное значение (его читают
 * функции отрисовки, `configs/renderQuality`) и зеркало в `GameStore` для
 * React-слоя (`useGameRuntime` пересобирает канвас под новый DPR, отладочная
 * панель показывает режим). Пока эти две записи жили по разным модулям, их
 * синхронизировали руками в каждом месте смены качества.
 */
export const applyRenderQuality = (quality: TRenderQuality): void => {
  setRenderQuality(quality);
  useGameStore.getState().setRenderQuality(quality);
};
