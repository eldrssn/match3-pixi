import { useAnimate } from 'motion/react';
import { useEffect, useRef, type RefObject } from 'react';
import { motionDuration, motionEase } from '@/shared/lib/motion';

type TAnimationControls = ReturnType<ReturnType<typeof useAnimate>[1]>;

/**
 * Плавно анимирует изменение высоты карточки модалки при живой смене
 * контента (спиннер → награды, ошибка под полем ввода и т.п.) вместо
 * мгновенного прыжка.
 *
 * Не использует `layout` motion (FLIP через `scale`) — тот масштабирует всё
 * поддерево карточки на время перехода, из-за чего текст и картинки заметно
 * искажаются. Вместо этого высота меряется реальным пикселем через
 * `ResizeObserver` (между переходами у карточки нет инлайн-`height`, поэтому
 * замер отражает её настоящий естественный размер) и анимируется императивно
 * через `useAnimate` — тем же паттерном, что и перелёт персонажа на главной
 * (`MainHero`).
 *
 * `ResizeObserver` продолжает следить за узлом и во время самого перехода:
 * `isAnimatingRef` гасит кадры, которые порождает наша же анимация, иначе
 * каждый промежуточный px запускал бы новый цикл заморозки. На время
 * перехода `overflow` узла принудительно `hidden` — иначе при
 * `contentOverflow="visible"` растущий контент был бы виден раньше, чем до
 * него дорастёт бокс, — и возвращается к исходному значению по завершении.
 */
export const useAnimatedContentHeight = (
  ref: RefObject<HTMLElement | null>,
  enabled: boolean
): void => {
  const [, animate] = useAnimate();
  const lastHeightRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const activeControlsRef = useRef<TAnimationControls | null>(null);

  useEffect(() => {
    const node = ref.current;

    if (!enabled || !node) {
      return;
    }

    lastHeightRef.current = node.offsetHeight;

    const animateToHeight = (prevHeight: number, nextHeight: number) => {
      isAnimatingRef.current = true;
      const previousOverflow = node.style.overflow;

      // Замораживаем на старой высоте тем же тактом, до покраски — иначе
      // браузер на мгновение показал бы уже готовый новый размер до начала
      // анимации.
      node.style.height = `${prevHeight}px`;
      node.style.overflow = 'hidden';

      activeControlsRef.current?.stop();
      activeControlsRef.current = animate(
        node,
        { height: [prevHeight, nextHeight] },
        {
          duration: motionDuration.medium,
          ease: motionEase.enter,
          onComplete: () => {
            // Возвращаем `auto`, чтобы дальнейшие органические рефлоу (ресайз
            // окна, смена шрифта) не были заперты в устаревшем px-значении.
            node.style.height = 'auto';
            node.style.overflow = previousOverflow;
            isAnimatingRef.current = false;

            // Кадры `ResizeObserver`, пришедшие во время перехода, были
            // погашены (`isAnimatingRef`) - вместе с настоящим изменением
            // контента, если оно случилось. Перемеряем узел уже на `auto`: у
            // `victory` состояний подряд три (спиннер наград -> награды ->
            // появление кнопок), и без этой доводки второй переход стартовал
            // бы от устаревшей высоты и давал скачок.
            const settledHeight = node.offsetHeight;
            lastHeightRef.current = settledHeight;

            if (settledHeight !== nextHeight) {
              animateToHeight(nextHeight, settledHeight);
            }
          },
        }
      );
    };

    const observer = new ResizeObserver(() => {
      if (isAnimatingRef.current) {
        return;
      }

      const nextHeight = node.offsetHeight;
      const prevHeight = lastHeightRef.current;
      lastHeightRef.current = nextHeight;

      if (prevHeight === null || prevHeight === nextHeight) {
        return;
      }

      animateToHeight(prevHeight, nextHeight);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      activeControlsRef.current?.stop();
      node.style.height = 'auto';
      node.style.overflow = '';
      isAnimatingRef.current = false;
    };
  }, [animate, enabled, ref]);
};
