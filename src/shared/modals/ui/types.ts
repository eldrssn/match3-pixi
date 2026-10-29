import type { HTMLAttributes, PropsWithChildren } from 'react';

export interface IModalProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  isOpened: boolean;
  onClose?: () => void;
  fullscreen?: boolean;
  backdrop?: 'default' | 'transparent' | 'solid' | 'dim';
  backdropBlur?: boolean;
  /**
   * Оформление карточки. `dark` — тёмная карта с нейтральной обводкой по дизайну
   * игровых модалок: модалка выбирает её пропом, а не перебивает белый фон
   * примитива собственным классом с искусственно поднятой специфичностью.
   */
  surface?: 'light' | 'dark';
  contentOverflow?: 'hidden' | 'visible';
  closeOnEscape?: boolean;
  /**
   * Клик мимо карточки закрывает модалку. Включено по умолчанию для всех
   * модалок; выключать только там, где выбор обязателен.
   */
  closeOnOverlayClick?: boolean;
  /**
   * Анимировать изменение высоты карточки вместо мгновенного прыжка. Включено
   * по умолчанию для всех не-fullscreen модалок (на fullscreen-экране проп
   * игнорируется - высоту задаёт вьюпорт): высота меряется реальным пикселем
   * через `ResizeObserver` и анимируется императивно через `useAnimate`
   * (`useAnimatedContentHeight`), а не через `layout` motion (FLIP через
   * `scale`), поэтому содержимое не искажается на время перехода. Явно
   * выключать (`animateHeight={false}`) стоит только там, где нет смысла даже
   * держать наблюдатель - например, если высота карточки заведомо неизменна
   * на всё время её жизни.
   */
  animateHeight?: boolean;
  /**
   * Крестик в правом верхнем углу карточки - явная замена случаям, когда в
   * `actions` нет отдельной кнопки чистого закрытия (у остальных кнопок и так
   * есть побочное действие: «Дальше», «Ещё раз», «На главную»...).
   */
  showCloseButton?: boolean;
  titleId?: string;
  descriptionId?: string;
}
