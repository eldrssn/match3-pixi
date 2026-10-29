import type { PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { useModalHost } from './ModalHostContext';

export const ModalPortal = ({ children }: PropsWithChildren) => {
  const host = useModalHost();

  if (!host) {
    return null;
  }

  return createPortal(children, host);
};
