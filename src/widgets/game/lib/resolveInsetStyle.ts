import type { CSSProperties } from 'react';

/**
 * Проп `insets` -> инлайновые CSS-переменные экрана партии. Задаются только
 * переданные стороны: остальные хост вправе вести своими переменными на
 * предке (см. `IGameScreenProps.insets`).
 */
export const resolveInsetStyle = (top?: number, bottom?: number): CSSProperties | undefined => {
  if (top === undefined && bottom === undefined) {
    return undefined;
  }

  return {
    ...(top !== undefined && { '--match3-inset-top': `${top}px` }),
    ...(bottom !== undefined && { '--match3-inset-bottom': `${bottom}px` }),
  } as CSSProperties;
};
