import { SHARED_TEXTS } from '@/shared/texts';
import { pluralizeRu } from './pluralizeRu';

const MOVES_WORD_FORMS = SHARED_TEXTS.movesWordForms;

/** Слово «ход» в форме под число: 1 ход, 3 хода, 5 ходов. Подпись счётчика ходов (Figma 15602-44744). */
export const movesWord = (moves: number): string => pluralizeRu(moves, MOVES_WORD_FORMS);

/** Число ходов со словом: карточки уровня и near-miss, каталог редактора. */
export const formatMoves = (moves: number): string => `${moves} ${movesWord(moves)}`;
