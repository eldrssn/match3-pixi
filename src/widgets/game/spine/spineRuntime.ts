import { Spine, type TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Assets, type Texture, type TextureSource } from 'pixi.js';
import type { ISkinSpineView } from '@/entities/skin';
import { configureTextureLoader, toImageBitmap } from '../textures/loadSkinTextures';
import type { ISpineActor, ISpineRuntimeModule, ISpineSupport } from './spineSupport';

/**
 * Рантайм Spine - ленивый чанк `spine`: модуль импортируется только
 * динамически (`spineSupport.importSpineRuntime`), и только если в активном
 * скине есть вид клетки `spine`. Статический импорт этого файла из рантайма
 * партии притащил бы `@esotericsoftware/spine-pixi-v8` в `GameScreen`.
 *
 * Импорт пакета регистрирует загрузчики Pixi `Assets` для `.atlas`, `.skel`
 * и `.json` скелета - больше подключать ничего не нужно.
 */

const SECOND_MS = 1000;
const TRACK = 0;

/**
 * Страницы атласа из скина (`atlas.pages`) - тем же путём, что файлы
 * текстур скина: `<img crossOrigin="anonymous">` и перевод в `ImageBitmap`
 * (см. `loadSkinTextures`). Без поля страницы грузит сам загрузчик атласа
 * рядом с `.atlas` - тоже через `loadTextures`, с тем же `crossOrigin`.
 */
const loadAtlasPages = async (
  pages: Readonly<Record<string, string>> | undefined
): Promise<Record<string, TextureSource> | undefined> => {
  if (!pages) {
    return undefined;
  }

  const entries = await Promise.all(
    Object.entries(pages).map(async ([name, url]) => {
      const texture = await Assets.load<Texture>(url);

      await toImageBitmap(texture);

      return [name, texture.source] as const;
    })
  );

  return Object.fromEntries(entries);
};

/** Имена анимаций вида, которых нет в скелете: опечатка в скине - отказ загрузки. */
const listMissingAnimations = (view: ISkinSpineView, spine: Spine): string[] => {
  const { idle, stages = [], appear, hit, destroy } = view.animations;

  return [idle, ...stages, appear, hit, destroy].filter(
    (name): name is string => Boolean(name) && !spine.skeleton.data.findAnimation(name as string)
  );
};

const loadView = async (view: ISkinSpineView): Promise<void> => {
  const images = await loadAtlasPages(view.atlas.pages);

  // Ключ кэша `Assets` - URL: тот же скелет у нескольких элементов
  // грузится один раз, следующая партия получает его без запроса.
  await Promise.all([
    Assets.load(view.skeleton),
    Assets.load(images ? { src: view.atlas.url, data: { images } } : view.atlas.url),
  ]);

  const probe = Spine.from({ skeleton: view.skeleton, atlas: view.atlas.url, autoUpdate: false });

  try {
    if (view.skin && !probe.skeleton.data.findSkin(view.skin)) {
      throw new Error(`[game] в скелете ${view.skeleton} нет скина «${view.skin}»`);
    }

    const missing = listMissingAnimations(view, probe);

    if (missing.length > 0) {
      throw new Error(`[game] в скелете ${view.skeleton} нет анимаций: ${missing.join(', ')}`);
    }
  } finally {
    probe.destroy();
  }
};

/**
 * Скелет клетки. Своего тикера у него нет (`autoUpdate: false`): время ему
 * двигает вид клетки с часов рантайма (`RuntimeMotion.onFrame` с темпом),
 * поэтому пауза партии и ускорение доски действуют на скелет так же, как на
 * твины.
 */
class SpineActor implements ISpineActor {
  readonly display: Spine;
  /** Резолверы ждущих разовых проходов: снятие скелета отпускает их все. */
  private readonly pending = new Set<() => void>();

  constructor(view: ISkinSpineView) {
    const spine = Spine.from({ skeleton: view.skeleton, atlas: view.atlas.url, autoUpdate: false });

    if (view.skin) {
      spine.skeleton.setSkin(view.skin);
      spine.skeleton.setupPoseSlots();
    }

    // Центр клетки - центр рамки позы покоя, а не корень скелета (обычно
    // он у «ног»): масштаб нажатия и приземления идёт от середины, как у
    // спрайта с якорем 0.5.
    spine.update(0);

    const bounds = spine.getLocalBounds();

    spine.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    this.display = spine;
  }

  play(animation: string, loop: boolean): Promise<void> {
    if (this.display.destroyed) {
      return Promise.resolve();
    }

    const entry: TrackEntry = this.display.state.setAnimation(TRACK, animation, loop);

    // Поза первого кадра - сразу, а не на следующем шаге часов.
    this.display.update(0);

    if (loop) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const done = () => {
        if (this.pending.delete(done)) {
          entry.listener = null;
          resolve();
        }
      };

      this.pending.add(done);
      entry.listener = { complete: done, interrupt: done, end: done, dispose: done };
    });
  }

  update(deltaMs: number): void {
    if (!this.display.destroyed && deltaMs > 0) {
      this.display.update(deltaMs / SECOND_MS);
    }
  }

  destroy(): void {
    [...this.pending].forEach((done) => done());

    if (!this.display.destroyed) {
      this.display.destroy();
    }
  }
}

export const createSpineSupport: ISpineRuntimeModule['createSpineSupport'] = async (views) => {
  configureTextureLoader();
  await Promise.all(views.map(loadView));

  return {
    createActor: (view) => new SpineActor(view),
  } satisfies ISpineSupport;
};
