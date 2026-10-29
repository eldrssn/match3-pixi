import clsx from 'clsx';
import { motion } from 'motion/react';
import { useRef } from 'react';
import { motionDuration, motionEase } from '@/shared/lib/motion';
import { SHARED_TEXTS } from '@/shared/texts';
import CloseIcon from '@/assets/icons/common/close.svg?react';
import styles from './styles.module.scss';
import type { IModalProps } from './types';
import { useAnimatedContentHeight } from '../lib/useAnimatedContentHeight';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useFocusTrap } from '../lib/useFocusTrap';
import { useModalEscapeStack } from '../lib/useModalEscapeStack';
import { useModalStackZIndex } from './useModalStackZIndex';

export const ModalLayout = ({
  onClose,
  children,
  fullscreen = false,
  backdrop = 'default',
  backdropBlur = true,
  surface = 'light',
  contentOverflow = 'hidden',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  animateHeight = true,
  showCloseButton = false,
  titleId,
  descriptionId,
  className,
}: IModalProps) => {
  const zIndex = useModalStackZIndex();
  const isTransparent = backdrop === 'transparent';
  const isSolid = backdrop === 'solid';
  const isDim = backdrop === 'dim';
  const shouldFadeWrapOnly = isSolid || fullscreen;
  // На fullscreen-экране высоту задаёт вьюпорт - анимировать её нечего.
  const isHeightAnimated = animateHeight && !fullscreen;
  const wrapMotion = shouldFadeWrapOnly
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, scale: 0.98, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 8 },
      };

  // Клик мимо карточки ловит полноэкранный `.wrap`. Сама карточка гасит
  // всплытие ниже.
  const handleBackdropClick = closeOnOverlayClick ? onClose : undefined;

  useBodyScrollLock();
  useModalEscapeStack(closeOnEscape, onClose);
  // Ловушка фокуса стоит на всём диалоге, а не на карточке.
  const dialogRef = useFocusTrap(true);
  const contentRef = useRef<HTMLDivElement>(null);
  useAnimatedContentHeight(contentRef, isHeightAnimated);

  return (
    <>
      <motion.div
        className={clsx(styles.overlay, {
          [styles.overlayTransparent]: isTransparent,
          [styles.overlaySolid]: isSolid,
          [styles.overlayDim]: isDim,
          [styles.overlayNoBlur]: !backdropBlur,
        })}
        style={{ zIndex: zIndex.overlay }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: motionDuration.base, ease: motionEase.enter }}
        onClick={handleBackdropClick}
        role="presentation"
      />

      <div
        ref={dialogRef}
        className={styles.dialog}
        style={{ zIndex: zIndex.wrap }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <motion.div
          className={clsx(styles.wrap, fullscreen && styles.wrapFullscreen)}
          style={{ zIndex: zIndex.wrap }}
          initial={wrapMotion.initial}
          animate={wrapMotion.animate}
          exit={wrapMotion.exit}
          transition={{ duration: motionDuration.medium, ease: motionEase.enter }}
          onClick={handleBackdropClick}
        >
          <div className={clsx(styles.anchor, fullscreen && styles.anchorFullscreen)}>
            <motion.div
              ref={contentRef}
              className={clsx(
                styles.content,
                fullscreen && styles.contentFullscreen,
                surface === 'dark' && styles.contentDark,
                contentOverflow === 'visible' && styles.contentOverflowVisible,
                className
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {showCloseButton && onClose ? (
                <button
                  type="button"
                  className={clsx(styles.closeButton, surface === 'dark' && styles.closeButtonDark)}
                  onClick={() => {
                    onClose();
                  }}
                  aria-label={SHARED_TEXTS.modalClose}
                >
                  <CloseIcon className={styles.closeIcon} aria-hidden="true" focusable="false" />
                </button>
              ) : null}
              {children}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </>
  );
};
