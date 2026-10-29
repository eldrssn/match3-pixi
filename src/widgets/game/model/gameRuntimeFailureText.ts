import type { TGameRuntimeFailure } from '../store/GameStore';
import { GAME_TEXTS } from '../texts';

export interface IGameRuntimeFailureText {
  title: string;
  description: string;
}

/**
 * Тексты отказа рантайма по причине (формулировки - `GAME_TEXTS.runtimeFailure`).
 *
 * Разные не ради разнообразия: битые ассеты - это «попробуйте ещё раз, скорее
 * всего сеть», потерянный контекст - «партия прервалась не по вашей вине», а
 * сорванный старт сцены - «этот уровень не открылся». Одинаковая фраза на все
 * случаи ничего не подсказала бы игроку о том, что делать дальше.
 *
 * Читателей два хоста: главная показывает их по `onError`, превью редактора
 * уровней - панелью поверх доски (там берётся только `title`: `description`
 * зовёт игрока начать уровень заново, а автору уровня нужна причина). Второй
 * копии причин быть не должно - иначе формулировки для игрока и для автора
 * уровня разъедутся на первой же правке.
 */
export const GAME_RUNTIME_FAILURE_TEXT: Record<TGameRuntimeFailure, IGameRuntimeFailureText> =
  GAME_TEXTS.runtimeFailure;
