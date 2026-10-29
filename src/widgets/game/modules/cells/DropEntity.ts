import { resolveDestroyTint } from '../../lib/destroyTint';
import { tweenDisplay } from '../../motion/displayMotion';
import { BASE_SCALE, BoardEntity } from './BoardEntity';

/** Подъём собранного предмета перед исчезновением, дизайн-px. */
const COLLECT_RISE = 24;
const COLLECT_MS = 260;

/**
 * «Опусти вниз» (кристалл): падает и свапается, как фишка, но не матчится и
 * урона не получает. Дошёл до дна колонки - движок отдаёт шаг `collect`, и
 * предмет взлетает к панели целей.
 */
export class DropEntity extends BoardEntity {
  /**
   * Сбор: предмет приподнимается и гаснет на месте. Шаг цели и полёт копии к
   * панели засчитывает проигрыватель шагов (`BoardStepPlayer`). Ждать не
   * нужно - доска оседает дальше параллельно.
   */
  public async collect(): Promise<void> {
    const image = this.image;

    this.input.setEnabled(false);

    if (image) {
      this.runtime.fx.emitDestroyBurst(image.x, image.y, resolveDestroyTint(this.id));
    }

    await tweenDisplay(
      this.runtime.core.motion,
      image,
      { y: (image?.y ?? 0) - COLLECT_RISE, scale: BASE_SCALE * 1.25, alpha: 0 },
      { duration: COLLECT_MS, ease: 'Quad.easeOut' }
    );
    this.disposeVisual();
  }
}
