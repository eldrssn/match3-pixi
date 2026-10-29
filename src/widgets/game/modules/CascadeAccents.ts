import type { IBoardCellPos } from '@/entities/game';
import type { IBoardBounds, IBoardFx } from '../fx/boardFx';
import { cellCenter } from '../lib/boardGeometry';
import { resolveComboAnchorCell } from '../lib/comboAnchor';
import {
  COMBO_PHRASES,
  pickNextComboPhrase,
  shouldShowComboPhrase,
  type TComboPhrase,
} from '../lib/comboPhrases';
import { useComboPhraseStore } from '../store/comboPhraseStore';

/** С какой итерации каскада показывать множитель. */
const COMBO_FROM_ITERATION = 2;

/** С какой итерации каскад отдаётся в камеру. */
const CASCADE_PUNCH_FROM_ITERATION = 3;

/**
 * Акценты звена каскада (шаг `matches` движка): попап «×N», хайп-фраза и удар
 * камеры на глубокой цепочке. Три независимых эффекта со своими порогами -
 * ни один не завязан на другой.
 *
 * Множитель виден со второй итерации: игрок должен понять, что цепочка
 * совпадений ценнее одиночного матча.
 */
export class CascadeAccents {
  private readonly fx: IBoardFx;
  private readonly size: IBoardBounds;

  /** Последняя показанная хайп-фраза каскада и момент её показа (`performance.now()`). */
  private lastComboPhrase: TComboPhrase | null = null;
  private lastComboPhraseAt: number | null = null;

  constructor(fx: IBoardFx, size: IBoardBounds) {
    this.fx = fx;
    this.size = size;
  }

  play(iteration: number, groups: readonly IBoardCellPos[][]): void {
    this.showCascadeCombo(iteration, groups);
    this.maybeShowComboPhrase(iteration);
    this.emphasizeDeepCascade(iteration);
  }

  /**
   * «×N» в центре масс крупнейшей комбинации этой итерации - не на клетке, с
   * которой начался ход: на второй, третьей... итерации каскад уже гасит фишки
   * в другом месте доски, и попап обязан идти за ними. В правило уходят именно
   * группы, а не плоский список клеток: две несвязанные тройки у
   * противоположных краёв доски дали бы общий центр масс в пустом месте между
   * ними (см. `resolveComboAnchorCell`).
   */
  private showCascadeCombo(iteration: number, groups: readonly IBoardCellPos[][]): void {
    if (iteration < COMBO_FROM_ITERATION) {
      return;
    }

    const { x, y } = cellCenter(resolveComboAnchorCell(groups, this.size));

    this.fx.showComboPopup(x, y, iteration);
  }

  /**
   * Хайп-фраза каскада («ОБА-НА!» и т.п.) - более редкий акцент, чем «×N»:
   * не на каждой итерации, где виден множитель, а по вероятностному роллу с
   * кулдауном (`BOARD_TIMING.comboPhrase`), иначе длинная цепочка сыпала бы
   * фразами на каждом звене.
   */
  private maybeShowComboPhrase(iteration: number): void {
    const now = performance.now();

    if (!shouldShowComboPhrase(iteration, COMBO_FROM_ITERATION, now, this.lastComboPhraseAt)) {
      return;
    }

    const phrase = pickNextComboPhrase(COMBO_PHRASES, this.lastComboPhrase);

    this.lastComboPhrase = phrase;
    this.lastComboPhraseAt = now;
    useComboPhraseStore.getState().showComboPhrase(phrase);
  }

  /** Глубокий каскад слегка встряхивает камеру - цепочка ощущается мощью. */
  private emphasizeDeepCascade(iteration: number): void {
    if (iteration < CASCADE_PUNCH_FROM_ITERATION) {
      return;
    }

    this.fx.punchCamera('cascade');
  }
}
