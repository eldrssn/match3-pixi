import type { Renderer, WebGPURenderer } from 'pixi.js';
import { useGameStore } from '../store/GameStore';
import { createContextLossGuard } from './contextLossGuard';

/**
 * Мост «потеря графического контекста -> состояние партии» для обоих
 * рендереров Pixi. Автомат с таймаутом общий (`contextLossGuard`), различается
 * только источник событий:
 *
 * - **WebGL** - DOM-события канваса `webglcontextlost`/`webglcontextrestored`.
 *   Pixi (`GlContextSystem`) сам гасит дефолт потери и пересоздаёт ресурсы на
 *   восстановлении; мы только показываем спиннер и ждём.
 * - **WebGPU** - промис `device.lost`. Pixi (`GpuDeviceSystem`) на потере
 *   просит новое устройство и шлёт `contextChange` - это и есть
 *   восстановление; новое устройство снова может потеряться, поэтому подписка
 *   на `lost` переставляется на каждое.
 *
 * На потерю поднимается `isContextLost` (экран показывает спиннер вместо
 * чёрного канваса), на восстановление гаснет; не вернулся за
 * `CONTEXT_RESTORE_TIMEOUT_MS` - `failRuntime('context-lost')`.
 *
 * Подписка ставится сразу после `Application.init`: контекст может
 * отвалиться в любой момент, включая загрузку ассетов.
 */
export const watchRendererContext = (renderer: Renderer): (() => void) => {
  let isLost = false;
  let isDisposed = false;
  const guard = createContextLossGuard({
    isStillLost: () => isLost,
    onLostChange: (lost) => useGameStore.getState().setIsContextLost(lost),
    onFail: () => useGameStore.getState().failRuntime('context-lost'),
  });

  const handleLost = () => {
    if (isDisposed) {
      return;
    }

    isLost = true;
    guard.lost();
  };

  const handleRestored = () => {
    if (isDisposed || !isLost) {
      return;
    }

    isLost = false;
    guard.restored();
  };

  if (renderer.name === 'webgpu') {
    const gpuRenderer = renderer as WebGPURenderer;
    const watchDevice = (device: WebGPURenderer['gpu']['device']) => {
      void device.lost.then(() => {
        // Свой `destroy()` тоже резолвит `lost` (`reason: 'destroyed'`) - к
        // этому моменту подписка уже снята.
        handleLost();
      });
    };
    const runner = {
      contextChange: () => {
        handleRestored();
        watchDevice(gpuRenderer.gpu.device);
      },
    };

    watchDevice(gpuRenderer.gpu.device);
    gpuRenderer.runners.contextChange.add(runner);

    return () => {
      isDisposed = true;
      guard.dispose();
      gpuRenderer.runners.contextChange.remove(runner);
    };
  }

  const canvas = renderer.canvas;

  canvas.addEventListener('webglcontextlost', handleLost);
  canvas.addEventListener('webglcontextrestored', handleRestored);

  return () => {
    isDisposed = true;
    guard.dispose();
    canvas.removeEventListener('webglcontextlost', handleLost);
    canvas.removeEventListener('webglcontextrestored', handleRestored);
  };
};
