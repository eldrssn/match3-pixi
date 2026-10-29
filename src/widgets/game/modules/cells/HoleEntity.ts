import { BoardEntity } from './BoardEntity';

/** Дыра: отсутствие клетки. Не рисуется, не ловит касаний, не получает урона. */
export class HoleEntity extends BoardEntity {
  override render(): void {
    return;
  }

  protected override readonly acceptsInput = false;

  override async appearAnimation() {
    return Promise.resolve();
  }

  override canSwap(): boolean {
    return false;
  }

  override enableBoosterMode(): void {
    return;
  }

  override destroy(): Promise<void> {
    return Promise.resolve();
  }

  override takeDamage(): void {
    return;
  }
}
