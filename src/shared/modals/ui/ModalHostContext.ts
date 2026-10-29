import { createContext, useContext } from 'react';

/**
 * DOM-узел слоя модалок. Раздаётся через контекст, а не через
 * `document.getElementById` в момент рендера: контейнер создаётся эффектом, и
 * чтение по id во время рендера возвращало бы `null` на первом проходе.
 */
export const ModalHostContext = createContext<HTMLElement | null>(null);

export const useModalHost = (): HTMLElement | null => useContext(ModalHostContext);
