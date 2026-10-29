import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/shared/constants';
import { createRouteWithPreservedSearch } from '@/shared/lib/routing';
import { prefetchGameScreenChunk } from '@/widgets/game';
import { selectCurrentLevel, useMainFlowStore } from '../model/useMainFlowStore';
import { MAIN_TEXTS } from '../texts';
import styles from './MainActions.module.scss';

/**
 * Действия главной: начать партию текущего уровня, открыть карту уровней,
 * витрину механик или редактор уровней (только в сборке с редактором,
 * `__EDITOR_ENABLED__`).
 */
export const MainActions = () => {
  const play = useMainFlowStore((state) => state.play);
  const openMap = useMainFlowStore((state) => state.openMap);
  const openShowcase = useMainFlowStore((state) => state.openShowcase);
  const levelNumber = useMainFlowStore(selectCurrentLevel);
  const { search, hash } = useLocation();
  const editorRoute = createRouteWithPreservedSearch({
    currentSearch: search,
    currentHash: hash,
    to: ROUTES.EDITOR,
  });

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.button}
        onPointerDown={() => {
          prefetchGameScreenChunk();
        }}
        onClick={play}
      >
        {MAIN_TEXTS.actions.play(levelNumber)}
      </button>
      <button type="button" className={styles.button} onClick={openMap}>
        {MAIN_TEXTS.actions.map}
      </button>
      <button type="button" className={styles.button} onClick={openShowcase}>
        {MAIN_TEXTS.actions.showcase}
      </button>
      {__EDITOR_ENABLED__ ? (
        <Link to={editorRoute} className={styles.button}>
          {MAIN_TEXTS.actions.editor}
        </Link>
      ) : null}
    </div>
  );
};
