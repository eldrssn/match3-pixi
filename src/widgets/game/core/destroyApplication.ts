import { GlobalResourceRegistry, TexturePool, type Application } from 'pixi.js';

/**
 * Гасит приложение Pixi партии: канвас из DOM, сцену со всеми спрайтами и
 * глобальные ресурсы рендерера.
 *
 * Общие пулы Pixi (батчеры, пулы текстур рендера) отдаются, иначе копились
 * бы от партии к партии: живой рантайм один, делить их не с кем. Но пул
 * текстур рендера (`TexturePool`: в нём, например, текстуры текстов холста)
 * сначала забывается **без** уничтожения: WebGPU-батчер Pixi держит
 * bind group-ы в модульном кэше без очистки, и уничтожение текстуры, которую
 * такой bind group ещё помнит, сыпало бы в консоль «destroyed while still
 * bound» на каждый выход из партии (на WebGPU; так же делают холсты
 * процедурных текстур - см. `registerProceduralTextures`). GPU-память этих текстур уходит вместе с
 * рендерером, объекты - сборщику мусора; остальные пулы чистит
 * `GlobalResourceRegistry.release()` как обычно.
 *
 * Текстуры скина не трогаем: файлы живут в кэше `Assets`, холсты - в кэше
 * `registerProceduralTextures`, обе стороны нужны следующей партии.
 *
 * `releaseGlobals: false` - для приложения, чей `init` вернулся уже после
 * старта следующей партии: общие пулы в этот момент принадлежат ей, и их
 * очистка уничтожила бы батчи, которыми она рисует (следующий кадр падал бы в
 * батчере). Пулы почистит её собственное уничтожение.
 */
export const destroyApplication = (
  app: Application,
  { releaseGlobals = true }: { releaseGlobals?: boolean } = {}
): void => {
  // Сцена - до рендерера: тексты отдают свои текстуры в пул на уничтожении,
  // а рендерер на своём `destroy` чистит пул под размер экрана - уже с
  // уничтожением. Поэтому пул забывается между этими двумя шагами.
  app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));

  if (releaseGlobals) {
    TexturePool.clear(false);
  }

  app.destroy({ removeView: true, releaseGlobalResources: false }, { children: true });

  if (releaseGlobals) {
    TexturePool.clear(false);
    GlobalResourceRegistry.release();
  }
};
