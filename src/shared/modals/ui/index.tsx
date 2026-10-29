import { AnimatePresence } from 'motion/react';
import { ModalLayout } from './ModalLayout';
import { ModalPortal } from './ModalPortal';
import type { IModalProps } from './types';

export const Modal = (props: IModalProps) => {
  const { isOpened } = props;

  return (
    <ModalPortal>
      <AnimatePresence mode="wait">
        {isOpened ? <ModalLayout key="modal" {...props} /> : null}
      </AnimatePresence>
    </ModalPortal>
  );
};

export type { IModalProps };
