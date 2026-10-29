// Токены общей моушн-подачи UI.
//
// `prefers-reduced-motion` не учитывается нигде в проекте, исключений нет:
// анимации входа и смены экранов - часть подачи, а не украшение поверх неё, и
// вторых «тихих» веток у них не заводим. Не добавляй сюда и в компоненты ни
// `@media (prefers-reduced-motion)`, ни `useReducedMotion()` - правило снято
// намеренно и сплошным (см. CLAUDE.md, раздел Styles).
//
// Пресеты живут константами, а не хуками: решать во время рендера им нечего, а
// префикс `use` навязывал бы rules-of-hooks на каждый вызов ради ничего.

export const motionDuration = {
  base: 0.2,
  medium: 0.32,
} as const;

export const motionEase = {
  enter: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 0.2, 1],
} as const;

// Пружинный пресет для «механических» появлений мелких элементов - заметный,
// но контролируемый overshoot.
export const motionSpring = {
  mechanical: { type: 'spring', stiffness: 380, damping: 22, mass: 0.9 },
} as const;
