/** Рендерер, заданный QA-флагом. */
export type TQueryRendererMode = 'webgl' | 'webgpu';

/**
 * Dev/QA переключатель `?renderer=webgl|webgpu`: какой рендерер просить у
 * рантайма партии (`widgets/game`, проп `renderer`). По умолчанию рантайм
 * просит WebGPU и откатывается на WebGL, где WebGPU нет; флаг нужен, чтобы
 * проверить эффекты на обоих рендерерах на одной машине.
 *
 * `webgpu` - предпочтение, а не приказ: без WebGPU в браузере рантайм всё
 * равно поднимет WebGL (фактический рендерер видно в отладочной панели
 * `?gameDebug=true`). Любое другое значение игнорируется.
 */
export const readQueryRenderer = (search = window.location.search): TQueryRendererMode | null => {
  const raw = new URLSearchParams(search).get('renderer')?.trim().toLowerCase();

  return raw === 'webgl' || raw === 'webgpu' ? raw : null;
};
