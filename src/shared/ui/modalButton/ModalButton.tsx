import clsx from 'clsx';
import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import styles from './ModalButton.module.scss';

interface IModalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` - акцентная фиолетовая, `secondary` - нейтральная тёмная. */
  variant?: 'primary' | 'secondary';
}

/**
 * Кнопка тёмных игровых модалок: одна пара стилей на все модалки, чтобы
 * каждая не держала свою копию.
 */
export const ModalButton = ({
  variant = 'secondary',
  className,
  type = 'button',
  onClick,
  ...rest
}: IModalButtonProps) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // `aria-disabled` не блокирует клик, как `disabled`: кнопка остаётся в
    // фокусе, поэтому неактивность держится здесь.
    if (rest['aria-disabled'] === true || rest['aria-disabled'] === 'true') {
      return;
    }

    onClick?.(event);
  };

  return (
    <button
      type={type}
      className={clsx(styles.button, styles[variant], className)}
      onClick={handleClick}
      {...rest}
    />
  );
};
