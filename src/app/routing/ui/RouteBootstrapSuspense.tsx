import { Suspense, type PropsWithChildren } from 'react';
import styles from './RouteBootstrapSuspense.module.scss';

export const RouteBootstrapSuspense = ({ children }: PropsWithChildren) => {
  return (
    <div className={styles.root}>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
};
