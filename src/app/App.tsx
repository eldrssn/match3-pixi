import { BrowserRouter as Router } from 'react-router-dom';
import { AppRoutes } from './routing/Routes';
import { useIOSGestureHack } from './hooks/useIOSGestureHack';
import { useViewportHeight } from './hooks/useViewportHeight';
import { ModalsProvider } from '@/widgets/modals';
import styles from './App.module.scss';

/**
 * Обычная страница: ни моста в нативное приложение, ни safe-area, ни
 * десктопной рамки. Отступы под вырез - забота хоста, в который встраивают
 * игру (`insets` у `GameScreenLazy`).
 */
export const App = () => {
  useViewportHeight();
  useIOSGestureHack();

  return (
    <Router>
      <div className={styles.root}>
        <ModalsProvider>
          <AppRoutes />
        </ModalsProvider>
      </div>
    </Router>
  );
};
