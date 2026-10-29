/** Корень сцены глазами замка ввода: у Pixi это `app.stage`. */
export interface IRuntimeInputRoot {
  eventMode?: string;
}

/**
 * Замок ввода рантайма - единственный владелец `stage.eventMode`.
 *
 * Выключенный ввод - `eventMode = 'none'` у корня сцены: Pixi не ищет цели
 * указателя во всём дереве, и тап по слою хоста поверх доски (модалка,
 * спиннер, подсказка механики) до клеток не доходит. `inert` на `#root` тут не
 * помощник: слой модалок лежит вне `#root`, а Pixi слушает перемещение
 * указателя и на `document`.
 *
 * Перед каждым реальным переходом замок закрывает незавершённые жесты
 * (`addResetHook`): касание, открывшее DOM-слой, иначе оставило бы клетку
 * «в руке» - ввод выключен, и отпускание пальца до неё уже не дойдёт.
 * Повторная установка того же состояния жест не обрывает. Сами жесты
 * появятся в фазе 2 (контроллер ввода клеток регистрирует сброс здесь).
 */
export class RuntimeInput {
  private readonly root: IRuntimeInputRoot;
  private readonly resetHooks = new Set<() => void>();
  private enabled: boolean;

  constructor(root: IRuntimeInputRoot, isEnabled: boolean) {
    this.root = root;
    this.enabled = isEnabled;
    this.apply();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(isEnabled: boolean): void {
    if (this.enabled === isEnabled) {
      return;
    }

    this.resetGestures();
    this.enabled = isEnabled;
    this.apply();
  }

  /** Сброс незавершённого жеста на переходе замка; возвращает отписку. */
  addResetHook(reset: () => void): () => void {
    this.resetHooks.add(reset);

    return () => {
      this.resetHooks.delete(reset);
    };
  }

  resetGestures(): void {
    [...this.resetHooks].forEach((reset) => {
      try {
        reset();
      } catch (error) {
        console.error('[game] input reset failed', error);
      }
    });
  }

  destroy(): void {
    this.resetHooks.clear();
  }

  private apply(): void {
    // `static`, а не `passive`: корень - цель для жестов доски и кнопок HUD
    // (фаза 2-3); `passive` не пускал бы события к самому корню.
    this.root.eventMode = this.enabled ? 'static' : 'none';
  }
}
