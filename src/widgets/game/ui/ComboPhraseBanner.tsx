import { useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { motionEase, motionSpring } from '@/shared/lib/motion';
import { BOARD_TIMING } from '../configs/timing';
import { resolveComboPhraseFontSizePx } from '../lib/comboPhraseFit';
import { useComboPhraseStore } from '../store/comboPhraseStore';
import styles from './ComboPhraseBanner.module.scss';

const EXIT_TRANSITION = {
  duration: BOARD_TIMING.comboPhrase.outMs / 1000,
  ease: motionEase.exit,
};

/**
 * Ниже этой доли базового кегля фразу не ужимаем: совсем мелкий текст читать
 * хуже, чем перенесённый на две строки, а перенос - забота CSS.
 */
const MIN_FONT_RATIO = 0.62;

/**
 * Хайп-фраза каскада («ОБА-НА!» и т.п.) - DOM-оверлей по центру игрового поля
 * (Figma node 18938-26622), независимый от доски: в отличие от попапа «×N»
 * (встаёт на месте гаснущих фишек), это отдельный акцент поверх всего поля, а
 * не слой в дизайн-координатах канваса - поэтому обычный DOM-оверлей, а не
 * текст на канвасе.
 *
 * Показ и выбор фразы решает `GameLogic` (`maybeShowComboPhrase`, чистые
 * правила - `lib/comboPhrases`); этот компонент только читает мост-стор и сам
 * ведёт время жизни карточки - `GameLogic` не знает о длительности показа.
 */
export const ComboPhraseBanner = () => {
  const activePhrase = useComboPhraseStore((state) => state.activePhrase);
  const token = activePhrase?.token ?? null;
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (token === null) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      useComboPhraseStore.getState().clearComboPhrase();
    }, BOARD_TIMING.comboPhrase.holdMs);

    return () => window.clearTimeout(timeout);
  }, [token]);

  // Фраза не должна пережить экран партии: стор модульный, а таймер выше -
  // внутри этого компонента. Экран может уйти прямо во время показа
  // (подтверждённый выход, сбой рантайма), и без этой уборки следующая партия
  // открылась бы с чужой фразой на первом кадре.
  useEffect(
    () => () => {
      useComboPhraseStore.getState().clearComboPhrase();
    },
    []
  );

  // Fit-to-width: длинная фраза («Феноменально!») на базовом кегле не влезает в
  // строку и вылезает за `max-width`. Меряем её в одну строку и ужимаем шрифт;
  // ниже предела CSS переносит на две строки сам. Замер трансформа не касается
  // (`scrollWidth`/`clientWidth` - layout-бокс), так что анимация входа `scale`
  // не мешает.
  useLayoutEffect(() => {
    const el = textRef.current;

    if (el === null || token === null) {
      return undefined;
    }

    const fit = () => {
      el.style.fontSize = '';
      el.style.whiteSpace = 'nowrap';

      const basePx = Number.parseFloat(window.getComputedStyle(el).fontSize);
      const nextPx = resolveComboPhraseFontSizePx(
        el.scrollWidth,
        el.clientWidth,
        basePx,
        basePx * MIN_FONT_RATIO
      );

      el.style.whiteSpace = '';
      el.style.fontSize = nextPx < basePx ? `${nextPx}px` : '';
    };

    fit();
    window.addEventListener('resize', fit);

    return () => window.removeEventListener('resize', fit);
  }, [token]);

  return (
    <div className={styles.root} aria-hidden="true">
      <AnimatePresence>
        {activePhrase ? (
          <motion.p
            key={activePhrase.token}
            ref={textRef}
            className={styles.text}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1, transition: motionSpring.mechanical }}
            exit={{ opacity: 0, scale: 0.9, transition: EXIT_TRANSITION }}
          >
            {activePhrase.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
