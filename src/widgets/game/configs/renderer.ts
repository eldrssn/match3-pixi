/**
 * Какой рендерер просить у Pixi для партии. `auto` (по умолчанию) - WebGPU с
 * откатом на WebGL; `webgl`/`webgpu` - предпочтение от хоста (QA-флаг
 * `?renderer=` у шаблонной главной).
 *
 * Модуль без Pixi: тип уходит в баррель виджета, а правило покрыто тестом.
 */
export type TRendererMode = 'auto' | 'webgl' | 'webgpu';

/** Рендереры, которые рантайм умеет поднять (`Renderer.name` у Pixi). */
export type TRendererKind = 'webgl' | 'webgpu';

/**
 * Предпочтение для `Application.init({ preference })`.
 *
 * Это именно предпочтение: Pixi (`autoDetectRenderer`) пробует названный
 * рендерер первым и откатывается на следующий, если тот не поднялся. Поэтому
 * `webgpu` в браузере без WebGPU честно даёт WebGL, а не отказ партии, а
 * `webgl` - единственный способ проверить WebGL-ветку на машине с WebGPU.
 *
 * `auto` = `webgpu`: требование заказчика - WebGPU там, где он есть.
 */
export const resolveRendererPreference = (mode: TRendererMode): TRendererKind =>
  mode === 'webgl' ? 'webgl' : 'webgpu';

/** Имя рендерера Pixi -> вид рантайма; незнакомое имя (Canvas) - `null`. */
export const toRendererKind = (name: string): TRendererKind | null =>
  name === 'webgl' || name === 'webgpu' ? name : null;
