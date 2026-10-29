import { Text } from 'pixi.js';
import { toRuntimeTextStyle, type IRuntimeTextConfig } from './runtimeTextStyle';

/**
 * Текст сцены по конфигу эталона (`GAME_CONFIG.*TextConfig`), с якорем по
 * центру - как `setOrigin(0.5, 0.5)` у Phaser.
 *
 * Разрешение печати фиксируется в момент создания (`getTextResolution`: от
 * `worldScale`, а не от DPR), шрифт к этому моменту уже загружен
 * (`waitGameFonts` в `bootGameRuntime`): Pixi меряет метрики шрифта один раз,
 * и текст, созданный до загрузки `@font-face`, остался бы с метриками
 * запасного.
 */
export const createRuntimeText = (
  text: string,
  config: IRuntimeTextConfig,
  overrides: Partial<Pick<IRuntimeTextConfig, 'fontSize'>> = {}
): Text => {
  const label = new Text({
    text,
    style: toRuntimeTextStyle(config, overrides),
    resolution: config.resolution,
  });

  label.anchor.set(0.5);

  return label;
};
