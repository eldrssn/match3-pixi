/**
 * Сколько ждём восстановления графического контекста, прежде чем считать
 * партию потерянной. Число то же, что у Phaser-эталона.
 *
 * Контекст в WebView теряется штатно - при сворачивании приложения, нехватке
 * видеопамяти, переключении вкладок, - и Pixi восстанавливает его сам: WebGL
 * по `webglcontextrestored` (`GlContextSystem`), WebGPU - новым устройством
 * после `device.lost` (`GpuDeviceSystem`). Обычно это происходит в тот же
 * момент, когда игрок возвращается в приложение. Ждать бесконечно нельзя:
 * если контекст не вернулся, игрок остаётся перед чёрным канвасом с живой
 * партией.
 */
export const CONTEXT_RESTORE_TIMEOUT_MS = 15000;

export interface IContextLossGuardOptions {
  /** Контекст всё ещё потерян - сверка на срабатывании таймера. */
  isStillLost: () => boolean;
  /** Потеря началась (`true`) или закончилась (`false`): спиннер поверх канваса. */
  onLostChange: (isLost: boolean) => void;
  /** Контекст не вернулся за отведённое время: партию продолжать нечем. */
  onFail: () => void;
  timeoutMs?: number;
}

export interface IContextLossGuard {
  lost: () => void;
  restored: () => void;
  dispose: () => void;
}

/**
 * Мост «потеря графического контекста -> состояние партии», без Pixi: события
 * потери и восстановления подаёт рантайм (`lib/watchRendererContext`), а
 * здесь только автомат с таймаутом - он один на WebGL и WebGPU и покрыт
 * тестом.
 */
export const createContextLossGuard = ({
  isStillLost,
  onLostChange,
  onFail,
  timeoutMs = CONTEXT_RESTORE_TIMEOUT_MS,
}: IContextLossGuardOptions): IContextLossGuard => {
  let restoreTimeout: number | null = null;
  let isDisposed = false;

  const clearRestoreTimeout = () => {
    if (restoreTimeout !== null) {
      window.clearTimeout(restoreTimeout);
      restoreTimeout = null;
    }
  };

  return {
    lost: () => {
      if (isDisposed) {
        return;
      }

      onLostChange(true);
      clearRestoreTimeout();

      restoreTimeout = window.setTimeout(() => {
        restoreTimeout = null;

        // Таймеры в скрытой вкладке тормозятся, и срабатывание могло догнать
        // уже восстановленный контекст - тогда партия в порядке.
        if (isDisposed || !isStillLost()) {
          return;
        }

        onFail();
      }, timeoutMs);
    },
    restored: () => {
      if (isDisposed) {
        return;
      }

      clearRestoreTimeout();
      onLostChange(false);
    },
    dispose: () => {
      isDisposed = true;
      clearRestoreTimeout();
    },
  };
};
