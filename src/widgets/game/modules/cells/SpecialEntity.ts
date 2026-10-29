import type { Sprite } from 'pixi.js';
import type { IMotionTween, RuntimeMotion } from '../../motion/RuntimeMotion';
import { BoardEntity } from './BoardEntity';
import { burstMotion } from './views/cellMotions';
import type { ICellLook } from './views/cellView';

/**
 * Спецфишка на доске: ракета, пропеллер, бомба или радуга.
 *
 * Общее у всех четырёх:
 *
 * - одиночный тап срабатывает (`cellTap` -> `GameLogic`), если это не второй
 *   тап хода двумя тапами;
 * - свапается с любым соседом - что из этого выйдет, решает движок;
 * - подсвечивается как выход из тупика, когда ходов фишками нет;
 * - уходит с доски вспышкой частиц, без замаха и схлопывания фишки: её
 *   собственная анимация - это взрыв, который уже отыграл шаг `detonate`.
 *
 * Как она выглядит, задаёт наследник: текстура покоя, её масштаб под клетку и
 * украшение спрайта (`decorate`).
 */
export abstract class SpecialEntity extends BoardEntity {
  /** Ключ текстуры спецфишки на доске. */
  protected abstract readonly restingTexture: string;

  /** Масштаб текстуры покоя под клетку: «дизайн-px / ширина текстуры». */
  protected abstract readonly restingScale: number;

  protected override look(): ICellLook {
    return {
      texture: () => this.restingTexture,
      baseScale: this.restingScale,
      decorate: (image, motion) => this.decorate(image, motion),
      destroy: burstMotion,
    };
  }

  /**
   * Украшение спрайта поверх текстуры: поворот ракеты, вращение радуги.
   * Вернувшийся твин вид снимет вместе со спрайтом.
   */
  protected decorate(_image: Sprite, _motion: RuntimeMotion): IMotionTween | null {
    return null;
  }

  override canSwap(): boolean {
    return true;
  }

  /**
   * Подсветка спецфишки как единственного выхода из тупика. Идемпотентна (см.
   * `ICellView.highlight`); срабатывает спецфишка обычным тапом.
   */
  public highlightSpecial(): void {
    this.view.highlight(true);
  }

  public unhighlightSpecial(): void {
    this.view.highlight(false);
  }

  override destroy(): Promise<void> {
    this.unhighlightSpecial();

    return super.destroy();
  }
}
