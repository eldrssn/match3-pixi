import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { motionDuration, motionEase } from '@/shared/lib/motion';
import { SHARED_TEXTS } from '@/shared/texts';
import styles from './Spinner.module.scss';

const DEFAULT_SPINNER_LABEL = SHARED_TEXTS.spinnerLabel;

interface ISpinnerProps {
  className?: string;
  isActive?: boolean;
  /**
   * Анимировать появление (только `overlay`-режим). `false` нужен там, где
   * спиннер приходит на смену уже видимому спиннеру соседнего экрана: своя
   * анимация входа дала бы просадку яркости ровно в момент подмены.
   */
  animateIn?: boolean;
  /**
   * Анимировать исчезновение (только `overlay`-режим). `false` нужен там, где
   * спиннер прячет уже живую, самостоятельно анимирующуюся сцену: плавное
   * затухание держало бы полупрозрачный спиннер поверх её же анимации ещё
   * `motionDuration.base` - смена должна быть мгновенной, а не кросс-фейдом.
   */
  animateOut?: boolean;
  noBg?: boolean;
  overlay?: boolean;
  variant?: 'primary' | 'error';
  /**
   * Размер кольца. `compact` - кольцо для тёмной карточки модалки: оно стоит
   * не вместо экрана, а внутри неё, рядом с текстом. Числа живут в примитиве,
   * потому что потребителей у этого размера двое (награды и результат партии),
   * и локальные копии `--ring-thickness`/`width`/`height` у них уже совпадали
   * побайтово - разойтись им было только вопросом времени.
   */
  size?: 'default' | 'compact';
  ariaLabel?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
  /**
   * Видимая подпись под кольцом (Figma `17234-52986`).
   * По умолчанию берётся `ariaLabel`, а если его нет - показывается
   * дефолтный текст "Загрузка". `false` скрывает подпись и оставляет
   * только `aria-label` для скринридера.
   */
  label?: string | false;
}

export const Spinner: React.FC<ISpinnerProps> = ({
  animateIn = true,
  animateOut = true,
  ariaLabel,
  ariaLive = 'polite',
  className,
  isActive = true,
  label,
  noBg,
  overlay,
  size = 'default',
  variant,
}) => {
  const rootClassName = clsx(styles.spinner, {
    [styles.overlay]: overlay,
    [styles.noBg]: noBg,
  });

  const visibleLabel = label === false ? null : (label ?? ariaLabel ?? DEFAULT_SPINNER_LABEL);
  const hasStatus = Boolean(visibleLabel || ariaLabel);

  const content = (
    <>
      <span
        className={clsx(styles.ring, className, {
          [styles.ringCompact]: size === 'compact',
          [styles.error]: variant === 'error',
        })}
      />
      {visibleLabel ? <span className={styles.label}>{visibleLabel}</span> : null}
    </>
  );

  const statusProps = {
    role: hasStatus ? ('status' as const) : undefined,
    'aria-live': hasStatus ? ariaLive : undefined,
    'aria-label': visibleLabel ? undefined : ariaLabel,
  };

  if (!overlay) {
    if (!isActive) {
      return null;
    }

    return (
      <div className={rootClassName} {...statusProps}>
        {content}
      </div>
    );
  }

  // `initial` у `AnimatePresence` гасит вход только на первом рендере - ровно
  // то, что нужно подмене экранов; повторное появление спиннера в живом
  // компоненте анимируется как обычно.
  return (
    <AnimatePresence initial={animateIn}>
      {isActive ? (
        <motion.div
          className={rootClassName}
          {...statusProps}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: motionDuration.base, ease: motionEase.enter },
          }}
          exit={{
            opacity: 0,
            transition: { duration: animateOut ? motionDuration.base : 0, ease: motionEase.enter },
          }}
        >
          {content}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
