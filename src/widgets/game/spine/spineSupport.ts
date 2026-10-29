import type { Container } from 'pixi.js';
import { listSkinSpineViews, type ISkinSpineView } from '@/entities/skin';

/**
 * Скелет Spine одной клетки глазами вида (`SpineCellView`): объект на доске,
 * анимации на дорожке 0 и шаг времени. Рантайм Spine (`spineRuntime`) за этим
 * контрактом, поэтому вид клетки не тянет `@esotericsoftware/spine-pixi-v8`
 * статически и тестируется подделкой.
 */
export interface ISpineActor {
  /** Объект скелета: сущностям доски нужен только `Container`. */
  readonly display: Container;
  /**
   * Ставит анимацию на дорожку 0 вместо текущей. Промис разового прохода
   * (`loop: false`) резолвится по его концу, по смене анимации и по `destroy`;
   * у цикла - сразу.
   */
  play(animation: string, loop: boolean): Promise<void>;
  /** Сдвигает скелет на `deltaMs` часов рантайма (`autoUpdate` выключен). */
  update(deltaMs: number): void;
  /** Снимает скелет; ждущие проходы резолвятся. */
  destroy(): void;
}

/** Загруженная поддержка Spine партии: скелеты активного скина. */
export interface ISpineSupport {
  /** Скелет вида клетки; скелет и атлас уже загружены (`loadSpineSupport`). */
  createActor(view: ISkinSpineView): ISpineActor;
}

/** Модуль ленивого чанка `spine` (`spineRuntime.ts`). */
export interface ISpineRuntimeModule {
  createSpineSupport(views: readonly ISkinSpineView[]): Promise<ISpineSupport>;
}

/**
 * Динамический импорт рантайма Spine - единственная дорога к
 * `@esotericsoftware/spine-pixi-v8`. Сборка кладёт его в отдельный чанк
 * `spine` (`manualChunks` в `vite.config.ts`), и браузер качает его только
 * отсюда.
 */
export const importSpineRuntime = (): Promise<ISpineRuntimeModule> => import('./spineRuntime');

/**
 * Поддержка Spine для партии: скелеты и атласы видов `spine` активного скина.
 *
 * Скин без вида `spine` (скин по умолчанию) - `null` без импорта: чанк
 * `spine` не запрашивается вовсе. Иначе - импорт чанка и загрузка всех
 * скелетов до сборки сцены (как файлы текстур): сущность создаёт вид клетки
 * синхронно, ждать ей нечего. Ошибка загрузки (нет файла, нет анимации из
 * скина) - исключение: загрузчик партии отказывает хосту, как на битой
 * текстуре.
 */
export const loadSpineSupport = async (
  views: readonly ISkinSpineView[] = listSkinSpineViews(),
  importRuntime: () => Promise<ISpineRuntimeModule> = importSpineRuntime
): Promise<ISpineSupport | null> => {
  if (views.length === 0) {
    return null;
  }

  const runtime = await importRuntime();

  return runtime.createSpineSupport(views);
};
