/**
 * Состояние партии, от которого зависит подсказка простоя (`modules/IdleHint`).
 * Собирается из сторов вызывающим (`GameLogic.resolveIdleHintPair`), само
 * правило про сторы и рантайм не знает - поэтому проверяется тестами.
 */
export interface IIdleHintGate {
  /** Идёт каскад/анимация: `GameLogic._isProcessing`. */
  isBoardBusy: boolean;
  /** Партия завершена - на экране модалка результата. */
  isGameEnded: boolean;
  /** Рантайм упал: доска заведомо сломана, сессию уже обрывает React-слой. */
  hasRuntimeFailure: boolean;
  /** Ходы кончились, партия ждёт решения хоста «+ходы или сдаться». */
  isAwaitingContinue: boolean;
}

/**
 * Можно ли сейчас подсказать ход пульсом.
 *
 * Занятая доска - не «игрок задумался», а идущий каскад: пара, найденная на
 * едущей доске, к моменту пульса уже уехала бы или была уничтожена, а
 * бесконечный твин остался бы висеть на снесённом спрайте.
 */
export const canShowIdleHint = (gate: IIdleHintGate): boolean =>
  !gate.isBoardBusy && !gate.isGameEnded && !gate.hasRuntimeFailure && !gate.isAwaitingContinue;
