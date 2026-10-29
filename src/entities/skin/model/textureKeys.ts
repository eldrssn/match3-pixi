/**
 * Сколько кадров у луча ракеты: рантайм проигрывает их по очереди
 * (`laser1`..`laserN`, `widgets/game/lib/specialFx`).
 */
export const ROCKET_BEAM_FRAME_COUNT = 9;

/**
 * Ключи текстур, которые рантайм партии берёт по имени: клетка поля, шапка и
 * панели, кнопки бустеров, эффекты. Скин обязан дать каждый - файлом или
 * процедурным рисованием (это держит тест скина).
 *
 * Текстур элементов здесь нет: их ключи скин выбирает сам и называет в
 * описании элемента (`ISkinElementBoard`), а рантайм читает их оттуда.
 */
export const RUNTIME_TEXTURE_KEYS: readonly string[] = [
  // Поле
  'tile',
  'tileBright',
  // Шапка, панели и кнопки бустеров
  'goalPannel',
  'boostersBg',
  'num',
  'exit',
  'soundToggleOn',
  'soundToggleOff',
  'targetedBooster',
  'boosterBeam',
  'boosterLaser',
  'boosterBall',
  // Эффекты
  ...Array.from({ length: ROCKET_BEAM_FRAME_COUNT }, (_, index) => `laser${index + 1}`),
  'light',
  'ellipse',
  'portal',
  'wave',
  'particle',
];
