import { Spinner } from '@/shared/ui/spinner';
import { GAME_TEXTS } from '../texts';
import styles from './GameLoadingShell.module.scss';

/**
 * Заглушка экрана партии на время загрузки чанка с рантаймом (Suspense fallback в
 * `GameScreenLazy`).
 *
 * Совпадает визуально с состоянием загрузки самого `GameScreen`: спиннер стоит
 * на том же месте, поэтому подмена заглушки на реальный экран проходит
 * незаметно - в переходе «Играть -> поле» нет второго лоадера с другим
 * оформлением.
 *
 * Спиннер здесь молчит для скринридера (`ariaLive="off"`): состояние уже
 * объявлено подписью самой секции, а следом смонтируется спиннер `GameScreen` -
 * без этого «Загрузка» прозвучала бы дважды подряд.
 */
export const GameLoadingShell = () => (
  <section className={styles.shell} aria-label={GAME_TEXTS.screen.loadingShell}>
    <div className={styles.board}>
      <Spinner overlay noBg ariaLive="off" ariaLabel={GAME_TEXTS.screen.loading} />
    </div>
  </section>
);
