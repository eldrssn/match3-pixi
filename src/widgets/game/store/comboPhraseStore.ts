import { create } from 'zustand';

interface IActiveComboPhrase {
  text: string;
  /** Инкрементится на каждый показ - даёт `AnimatePresence key` для React. */
  token: number;
}

interface ComboPhraseState {
  activePhrase: IActiveComboPhrase | null;
  showComboPhrase: (text: string) => void;
  clearComboPhrase: () => void;
}

/**
 * Мост «рантайм -> React» для хайп-фразы каскада («ОБА-НА!» и т.п.).
 *
 * `GameLogic` решает, когда и какую фразу показать (чистые правила -
 * `lib/comboPhrases`), и публикует текст сюда; DOM-баннер (`ComboPhraseBanner`)
 * читает стор и сам ведёт свою анимацию входа/выхода по `token`.
 */
export const useComboPhraseStore = create<ComboPhraseState>((set) => ({
  activePhrase: null,
  showComboPhrase: (text) =>
    set((state) => ({
      activePhrase: { text, token: (state.activePhrase?.token ?? 0) + 1 },
    })),
  clearComboPhrase: () => set({ activePhrase: null }),
}));
