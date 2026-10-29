/**
 * Отступы сцены от краёв канваса - зоны, куда нельзя класть интерактив и
 * текст (вырез, статус-бар, home-индикатор хоста). В CSS px.
 *
 * Значение модульное по той же причине, что и `renderScale`: модули сцены
 * читают его в `handleResize`, а живой рантайм в приложении один. Пишет его
 * только владелец канваса (`GameScreen`) -
 * замером своего DOM, после чего сам дёргает `scale.resize()`, и модули
 * пересчитываются по обычному `resize`. Отдельной подписки на смену отступов
 * у модулей нет.
 */
export interface ISceneInsets {
  top: number;
  bottom: number;
}

export const ZERO_SCENE_INSETS: ISceneInsets = { top: 0, bottom: 0 };

let sceneInsets: ISceneInsets = ZERO_SCENE_INSETS;

export const getSceneInsets = (): ISceneInsets => sceneInsets;

export const setSceneInsets = (next: ISceneInsets): void => {
  sceneInsets = { top: Math.max(0, next.top), bottom: Math.max(0, next.bottom) };
};

/**
 * Зовёт `bootGameRuntime` на старте и на уничтожении игры: без сброса отступы
 * партии пережили бы её, и рантайм, поднятый без замера отступов, получил бы
 * шапку, сдвинутую под чужой вырез.
 */
export const resetSceneInsets = (): void => {
  sceneInsets = ZERO_SCENE_INSETS;
};
